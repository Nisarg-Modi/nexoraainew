import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, Sparkles, Languages, Smile, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AISuggestions from "./AISuggestions";
import ChatSummarizer from "./ChatSummarizer";
import VoiceRecorder from "./VoiceRecorder";
import MessageTranslator from "./MessageTranslator";
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
      // Fetch sender profiles for group chats
      const messagesWithProfiles = await Promise.all(
        data.map(async (msg) => {
          let senderName = 'Unknown';
          
          if (isGroup && msg.sender_id !== currentUserId) {
            const { data: profile } = await supabase
              .rpc('get_safe_profile', { profile_user_id: msg.sender_id });
            senderName = profile?.[0]?.display_name || 'Unknown';
          }

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
        })
      );
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
        (payload) => {
          const newMsg = payload.new;
          
          // Fetch sender profile for group chats
          const fetchSenderProfile = async () => {
            const { data: profile } = await supabase
              .rpc('get_safe_profile', { profile_user_id: newMsg.sender_id });
            
            return profile?.[0]?.display_name || 'Unknown';
          };

          fetchSenderProfile().then((senderName) => {
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
                  senderName,
                  timestamp: new Date(newMsg.created_at),
                  aiGenerated: newMsg.ai_generated,
                  messageType: (newMsg.message_type || 'text') as 'text' | 'audio' | 'image',
                  audioData: newMsg.audio_data || undefined,
                  transcription: newMsg.transcription || undefined,
                },
              ];
            });
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

  return (
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

const Shield = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

export default ChatInterface;
