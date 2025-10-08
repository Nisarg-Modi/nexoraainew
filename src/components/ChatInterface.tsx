import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, Sparkles, Languages, Smile, Mic, Phone, Video, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AISuggestions from "./AISuggestions";
import ChatSummarizer from "./ChatSummarizer";
import VoiceRecorder from "./VoiceRecorder";
import MessageTranslator from "./MessageTranslator";
import { CallInterface } from "./CallInterface";
import { IncomingCallDialog } from "./IncomingCallDialog";
import EmojiPicker, { EmojiClickData, Theme, EmojiStyle } from 'emoji-picker-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Message {
  id: string;
  text: string;
  sender: "user" | "ai" | "contact";
  senderId?: string;
  senderName?: string;
  timestamp: Date;
  aiGenerated?: boolean;
  messageType?: 'text' | 'audio' | 'image';
  audioData?: string;
  transcription?: string;
}

const ChatInterface = ({ 
  contactUserId, 
  contactName,
  isGroup = false,
  conversationId: providedConversationId,
  onBack 
}: { 
  contactUserId: string;
  contactName: string;
  isGroup?: boolean;
  conversationId?: string;
  onBack: () => void;
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeCall, setActiveCall] = useState<any>(null);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [callParticipants, setCallParticipants] = useState<Map<string, string>>(new Map());
  const [profilesCache, setProfilesCache] = useState<Map<string, string>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const initUser = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        setCurrentUserId(userData.user.id);
      }
    };
    initUser();
  }, []);

  useEffect(() => {
    if (isGroup && providedConversationId) {
      setConversationId(providedConversationId);
      setLoading(false);
    } else if (contactUserId) {
      initializeConversation();
    }
  }, [contactUserId, isGroup, providedConversationId]);

  useEffect(() => {
    if (conversationId && currentUserId) {
      fetchMessages();
      const cleanup = subscribeToMessages();
      return cleanup;
    }
  }, [conversationId, currentUserId]);

  // Subscribe to incoming calls
  useEffect(() => {
    if (!currentUserId || !conversationId) return;

    const channel = supabase
      .channel('calls-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'calls',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const call = payload.new;
          if (call.caller_id !== currentUserId && call.status === 'ringing') {
            // Get caller info
            const { data: callerProfile } = await supabase
              .from('profiles')
              .select('display_name')
              .eq('user_id', call.caller_id)
              .single();

            setIncomingCall({
              ...call,
              callerName: callerProfile?.display_name || 'Unknown',
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, conversationId]);

  const initializeConversation = async () => {
    try {
      const { data, error } = await supabase.rpc('get_or_create_conversation', {
        other_user_id: contactUserId,
      });

      if (error) throw error;
      setConversationId(data);
    } catch (error) {
      console.error('Error initializing conversation:', error);
      toast({
        title: "Error",
        description: "Failed to start conversation",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    if (!conversationId || !currentUserId) return;

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      toast({
        title: "Error",
        description: "Failed to load messages",
        variant: "destructive",
      });
    } else if (data) {
      // Get unique sender IDs
      const uniqueSenderIds = [...new Set(data.map(msg => msg.sender_id))];
      
      // Batch fetch all profiles at once
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', uniqueSenderIds);
      
      // Create profiles cache
      const newCache = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);
      setProfilesCache(newCache);

      // Map messages with cached profiles
      const messagesWithProfiles = data.map((msg) => {
        const senderName = newCache.get(msg.sender_id) || 'Unknown';

        return {
          id: msg.id,
          text: msg.content || msg.transcription || '',
          sender: msg.sender_id === currentUserId ? 'user' : 'contact',
          senderId: msg.sender_id,
          senderName,
          timestamp: new Date(msg.created_at),
          aiGenerated: msg.ai_generated,
          messageType: (msg.message_type || 'text') as 'text' | 'audio' | 'image',
          audioData: msg.audio_data || undefined,
          transcription: msg.transcription || undefined,
        } as Message;
      });
      
      setMessages(messagesWithProfiles);
    }
  };

  const subscribeToMessages = () => {
    if (!conversationId || !currentUserId) return () => {};

    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const newMsg = payload.new;
          
          // Use cached profile or fetch if not in cache
          let senderName = profilesCache.get(newMsg.sender_id);
          
          if (!senderName && isGroup && newMsg.sender_id !== currentUserId) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('display_name')
              .eq('user_id', newMsg.sender_id)
              .single();
            
            senderName = profile?.display_name || 'Unknown';
            
            // Update cache
            setProfilesCache(prev => new Map(prev).set(newMsg.sender_id, senderName!));
          }

          setMessages((prev) => {
            // Avoid duplicate messages
            if (prev.some(m => m.id === newMsg.id)) {
              return prev;
            }
            
            return [
              ...prev,
              {
                id: newMsg.id,
                text: newMsg.content || newMsg.transcription || '',
                sender: newMsg.sender_id === currentUserId ? 'user' : 'contact',
                senderId: newMsg.sender_id,
                senderName: senderName || 'Unknown',
                timestamp: new Date(newMsg.created_at),
                aiGenerated: newMsg.ai_generated,
                messageType: (newMsg.message_type || 'text') as 'text' | 'audio' | 'image',
                audioData: newMsg.audio_data || undefined,
                transcription: newMsg.transcription || undefined,
              },
            ];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || !conversationId) return;

    const messageContent = inputText.trim();
    setInputText("");
    setShowAISuggestions(false);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: userData.user.id,
      content: messageContent,
      message_type: 'text',
    });

    if (error) {
      console.error('Error sending message:', error);
      
      const errorMessage = error.message?.toLowerCase().includes('rate limit') || 
                          error.message?.toLowerCase().includes('check_message_rate_limit')
        ? "You've reached the message limit (100 messages per hour in this conversation). Please slow down."
        : "Failed to send message. Please try again.";
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      setInputText(messageContent);
    }
  };

  const handleVoiceRecording = async (transcription: string) => {
    if (!conversationId || !transcription.trim()) return;

    try {
      // Send message with transcription
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { error: insertError } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: userData.user.id,
        content: transcription.trim(),
        message_type: 'audio',
        transcription: transcription.trim(),
      });

      if (insertError) throw insertError;

    } catch (error) {
      console.error('Error sending voice message:', error);
      toast({
        title: "Failed to send",
        description: error instanceof Error ? error.message : "Failed to send voice message",
        variant: "destructive",
      });
    }
  };

  const handleAISuggestion = (suggestion: string) => {
    setInputText(suggestion);
    setShowAISuggestions(false);
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setInputText(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const startCall = async (isVideo: boolean) => {
    if (!conversationId || !currentUserId) return;

    try {
      // Create call record
      const { data: call, error: callError } = await supabase
        .from('calls')
        .insert({
          conversation_id: conversationId,
          caller_id: currentUserId,
          call_type: isVideo ? 'video' : 'audio',
          status: 'ringing',
        })
        .select()
        .single();

      if (callError) throw callError;

      // Get all participants
      const { data: participants } = await supabase
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conversationId);

      if (participants) {
        // Add all participants to call
        const participantInserts = participants.map(p => ({
          call_id: call.id,
          user_id: p.user_id,
          status: p.user_id === currentUserId ? 'joined' : 'invited',
        }));

        await supabase.from('call_participants').insert(participantInserts);

        // Get participant names
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', participants.map(p => p.user_id));

        const namesMap = new Map(
          profiles?.map(p => [p.user_id, p.display_name]) || []
        );
        setCallParticipants(namesMap);

        setActiveCall({
          ...call,
          participantIds: participants.map(p => p.user_id),
        });
      }
    } catch (error) {
      console.error('Error starting call:', error);
      toast({
        title: 'Error',
        description: 'Failed to start call',
        variant: 'destructive',
      });
    }
  };

  const acceptCall = async () => {
    if (!incomingCall || !currentUserId) return;

    try {
      // Update call participant status
      await supabase
        .from('call_participants')
        .update({ status: 'joined', joined_at: new Date().toISOString() })
        .eq('call_id', incomingCall.id)
        .eq('user_id', currentUserId);

      // Update call status to active
      await supabase
        .from('calls')
        .update({ status: 'active' })
        .eq('id', incomingCall.id);

      // Get all participants
      const { data: participants } = await supabase
        .from('call_participants')
        .select('user_id')
        .eq('call_id', incomingCall.id);

      // Get participant names
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', participants?.map(p => p.user_id) || []);

      const namesMap = new Map(
        profiles?.map(p => [p.user_id, p.display_name]) || []
      );
      setCallParticipants(namesMap);

      setActiveCall({
        ...incomingCall,
        participantIds: participants?.map(p => p.user_id) || [],
      });
      setIncomingCall(null);
    } catch (error) {
      console.error('Error accepting call:', error);
      toast({
        title: 'Error',
        description: 'Failed to join call',
        variant: 'destructive',
      });
    }
  };

  const rejectCall = async () => {
    if (!incomingCall || !currentUserId) return;

    try {
      await supabase
        .from('call_participants')
        .update({ status: 'rejected' })
        .eq('call_id', incomingCall.id)
        .eq('user_id', currentUserId);

      setIncomingCall(null);
    } catch (error) {
      console.error('Error rejecting call:', error);
    }
  };

  const endCall = () => {
    setActiveCall(null);
    setCallParticipants(new Map());
  };

  return (
    <>
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="hover:bg-primary/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <span className="font-semibold">{contactName[0].toUpperCase()}</span>
            </div>
            <div>
              <h2 className="font-semibold">{contactName}</h2>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <span className="w-2 h-2 bg-accent rounded-full" />
                {isGroup ? 'Group Chat' : 'Online'} · Encrypted Connection
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => startCall(false)}
            className="hover:bg-primary/10"
          >
            <Phone className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => startCall(true)}
            className="hover:bg-primary/10"
          >
            <Video className="w-5 h-5" />
          </Button>
          {conversationId && <ChatSummarizer conversationId={conversationId} />}
        </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-2">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-muted-foreground text-sm">Loading conversation...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble 
              key={message.id} 
              message={message} 
              contactName={contactName}
              isGroup={isGroup}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* AI Suggestions */}
      {showAISuggestions && (
        <AISuggestions
          currentText={inputText}
          conversationContext={messages.map(msg => ({
            sender: msg.sender === 'user' ? 'You' : contactName,
            text: msg.text
          }))}
          onSelectSuggestion={handleAISuggestion}
          onClose={() => setShowAISuggestions(false)}
        />
      )}

      {/* Input */}
      <div className="bg-card border-t border-border p-4">
        <div className="flex items-center gap-2">
          <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-primary/10 text-muted-foreground transition-transform hover:scale-110"
              >
                <Smile className="w-5 h-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent 
              side="top" 
              align="start" 
              className="w-auto p-0 border-0 shadow-xl"
            >
              <EmojiPicker
                onEmojiClick={handleEmojiClick}
                theme={Theme.AUTO}
                lazyLoadEmojis={true}
                searchPlaceHolder="Search emojis..."
                height={400}
                width={350}
                emojiStyle={EmojiStyle.NATIVE}
                previewConfig={{ showPreview: false }}
              />
            </PopoverContent>
          </Popover>
          <div className="flex-1 relative">
            <Input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSend()}
              placeholder="Message with Nexora AI..."
              className="bg-muted border-border pr-24"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-primary/10"
                onClick={() => setShowAISuggestions(!showAISuggestions)}
              >
                <Sparkles className="w-4 h-4 text-primary" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-secondary/10"
              >
                <Languages className="w-4 h-4 text-secondary" />
              </Button>
            </div>
          </div>
          <VoiceRecorder 
            onRecordingComplete={handleVoiceRecording}
            disabled={!conversationId}
          />
          <Button
            onClick={handleSend}
            disabled={!inputText.trim()}
            className="bg-primary hover:bg-primary-glow"
            size="icon"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          <Shield className="w-3 h-3 inline mr-1" />
          Encrypted in transit · AI-powered suggestions
        </p>
      </div>
    </div>

    {/* Active Call */}
    {activeCall && currentUserId && (
      <CallInterface
        callId={activeCall.id}
        userId={currentUserId}
        participantIds={activeCall.participantIds}
        participantNames={callParticipants}
        isVideo={activeCall.call_type === 'video'}
        onEndCall={endCall}
      />
    )}

    {/* Incoming Call Dialog */}
    {incomingCall && (
      <IncomingCallDialog
        open={!!incomingCall}
        callerName={incomingCall.callerName}
        isVideo={incomingCall.call_type === 'video'}
        onAccept={acceptCall}
        onReject={rejectCall}
      />
    )}
  </>
  );
};

const MessageBubble = ({ message, contactName, isGroup }: { message: Message; contactName: string; isGroup?: boolean }) => {
  const isUser = message.sender === "user";
  const isAI = message.sender === "ai";
  const isAudio = message.messageType === 'audio';

  return (
    <div
      className={cn(
        "flex gap-2 animate-slide-up",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-secondary to-primary flex items-center justify-center flex-shrink-0">
          {isAI ? (
            <Sparkles className="w-4 h-4" />
          ) : isGroup ? (
            <span className="text-xs font-semibold">{message.senderName?.[0]?.toUpperCase()}</span>
          ) : (
            <span className="text-xs font-semibold">{contactName[0].toUpperCase()}</span>
          )}
        </div>
      )}
      <div className="flex flex-col gap-2 max-w-[70%]">
        {isGroup && !isUser && (
          <p className="text-xs text-muted-foreground px-1">{message.senderName}</p>
        )}
        <div
          className={cn(
            "rounded-2xl px-4 py-2",
            isUser
              ? "bg-primary text-primary-foreground"
              : isAI
              ? "bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30 glow-ai"
              : "bg-card border border-border"
          )}
        >
          {isAudio && (
            <div className="flex items-center gap-2 mb-1">
              <Mic className="w-3 h-3 opacity-70" />
              <span className="text-xs opacity-70">Voice message</span>
            </div>
          )}
          <p className="text-sm">{message.text}</p>
          <p className="text-xs opacity-70 mt-1">
            {message.timestamp.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <MessageTranslator messageId={message.id} messageText={message.text} />
      </div>
    </div>
  );
};

export default ChatInterface;
