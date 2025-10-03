import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, Sparkles, Languages, Smile } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AISuggestions from "./AISuggestions";

interface Message {
  id: string;
  text: string;
  sender: "user" | "ai" | "contact";
  timestamp: Date;
  aiGenerated?: boolean;
}

const ChatInterface = ({ 
  contactUserId, 
  contactName, 
  onBack 
}: { 
  contactUserId: string;
  contactName: string;
  onBack: () => void;
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
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
    if (contactUserId) {
      initializeConversation();
    }
  }, [contactUserId]);

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
    } else {
      const formattedMessages: Message[] = data.map((msg) => ({
        id: msg.id,
        text: msg.content,
        sender: msg.sender_id === currentUserId ? 'user' : 'contact',
        timestamp: new Date(msg.created_at),
        aiGenerated: msg.ai_generated,
      }));
      setMessages(formattedMessages);
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
          
          setMessages((prev) => {
            // Avoid duplicate messages
            if (prev.some(m => m.id === newMsg.id)) {
              return prev;
            }
            
            return [
              ...prev,
              {
                id: newMsg.id,
                text: newMsg.content,
                sender: newMsg.sender_id === currentUserId ? 'user' : 'contact',
                timestamp: new Date(newMsg.created_at),
                aiGenerated: newMsg.ai_generated,
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
    });

    if (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
      setInputText(messageContent);
    }
  };

  const handleAISuggestion = (suggestion: string) => {
    setInputText(suggestion);
    setShowAISuggestions(false);
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
              Online · E2EE Active
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-primary hover:bg-primary/10"
        >
          <Sparkles className="w-5 h-5" />
        </Button>
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
            <MessageBubble key={message.id} message={message} contactName={contactName} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* AI Suggestions */}
      {showAISuggestions && (
        <AISuggestions
          currentText={inputText}
          onSelectSuggestion={handleAISuggestion}
          onClose={() => setShowAISuggestions(false)}
        />
      )}

      {/* Input */}
      <div className="bg-card border-t border-border p-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-primary/10 text-muted-foreground"
          >
            <Smile className="w-5 h-5" />
          </Button>
          <div className="flex-1 relative">
            <Input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSend()}
              placeholder="Message with Mercury AI..."
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
          End-to-end encrypted · Mercury AI processes locally
        </p>
      </div>
    </div>
  );
};

const MessageBubble = ({ message, contactName }: { message: Message; contactName: string }) => {
  const isUser = message.sender === "user";
  const isAI = message.sender === "ai";

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
          ) : (
            <span className="text-xs font-semibold">{contactName[0].toUpperCase()}</span>
          )}
        </div>
      )}
      <div
        className={cn(
          "max-w-[70%] rounded-2xl px-4 py-2",
          isUser
            ? "bg-primary text-primary-foreground"
            : isAI
            ? "bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30 glow-ai"
            : "bg-card border border-border"
        )}
      >
        <p className="text-sm">{message.text}</p>
        <p className="text-xs opacity-70 mt-1">
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
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
