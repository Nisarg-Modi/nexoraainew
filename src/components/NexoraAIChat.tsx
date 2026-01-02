import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Send, Sparkles, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
}

interface NexoraAIChatProps {
  onClose: () => void;
  initialQuery?: string;
}

const MAX_HISTORY_MESSAGES = 50;

const NexoraAIChat = ({ onClose, initialQuery }: NexoraAIChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const processedInitialQuery = useRef(false);
  const isRequestInProgress = useRef(false);
  const historyLoaded = useRef(false);

  // Load chat history from database on mount
  useEffect(() => {
    if (historyLoaded.current) return;
    historyLoaded.current = true;
    
    const loadHistory = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setIsLoadingHistory(false);
          return;
        }

        const { data, error } = await supabase
          .from('ai_chat_messages')
          .select('id, role, content')
          .order('created_at', { ascending: true })
          .limit(MAX_HISTORY_MESSAGES);

        if (error) {
          console.error('Failed to load chat history:', error);
        } else if (data && data.length > 0) {
          setMessages(data.map(m => ({ 
            id: m.id, 
            role: m.role as 'user' | 'assistant', 
            content: m.content 
          })));
        }
      } catch (error) {
        console.error('Failed to load chat history:', error);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadHistory();
  }, []);

  // Save message to database
  const saveMessage = async (message: Message): Promise<string | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const { data, error } = await supabase
        .from('ai_chat_messages')
        .insert({
          user_id: session.user.id,
          role: message.role,
          content: message.content,
        })
        .select('id')
        .single();

      if (error) {
        console.error('Failed to save message:', error);
        return null;
      }
      return data?.id || null;
    } catch (error) {
      console.error('Failed to save message:', error);
      return null;
    }
  };

  // Clear chat history from database
  const clearHistory = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { error } = await supabase
          .from('ai_chat_messages')
          .delete()
          .eq('user_id', session.user.id);

        if (error) {
          console.error('Failed to clear chat history:', error);
        }
      }
      
      setMessages([]);
      toast({
        title: 'Chat cleared',
        description: 'Conversation history has been cleared.',
      });
    } catch (error) {
      console.error('Failed to clear chat history:', error);
      toast({
        title: 'Error',
        description: 'Failed to clear chat history.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  useEffect(() => {
    if (initialQuery && !processedInitialQuery.current && !isRequestInProgress.current && !isLoadingHistory) {
      processedInitialQuery.current = true;
      const timer = setTimeout(() => {
        sendMessage(initialQuery);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [initialQuery, isLoadingHistory]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading || isRequestInProgress.current) return;
    
    // Prevent duplicate requests
    isRequestInProgress.current = true;

    // Validate message length on client side
    if (messageText.length > 10000) {
      toast({
        title: 'Message too long',
        description: 'Please keep your message under 10,000 characters.',
        variant: 'destructive',
      });
      return;
    }

    // Get authenticated session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast({
        title: 'Please sign in',
        description: 'You need to be signed in to use Nexora AI.',
        variant: 'destructive',
      });
      return;
    }

    const userMessage: Message = { role: 'user', content: messageText.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Save user message to database
    saveMessage(userMessage);

    let assistantContent = '';

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nexora-ai-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ 
          messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content }))
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        }
        if (response.status === 402) {
          throw new Error('Service temporarily unavailable. Please try again later.');
        }
        throw new Error(errorData.error || 'Failed to get response');
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Add empty assistant message to update
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages(prev => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                if (lastMessage?.role === 'assistant') {
                  lastMessage.content = assistantContent;
                }
                return newMessages;
              });
            }
          } catch {
            // Incomplete JSON, put back in buffer
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      // Save assistant message to database after streaming completes
      if (assistantContent) {
        saveMessage({ role: 'assistant', content: assistantContent });
      }
    } catch (error) {
      console.error('Nexora AI error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to get AI response',
        variant: 'destructive',
      });
      // Remove empty assistant message on error
      setMessages(prev => prev.filter(m => m.content !== ''));
    } finally {
      setIsLoading(false);
      isRequestInProgress.current = false;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const quickPrompts = [
    { emoji: '😂', text: 'Tell me a joke' },
    { emoji: '🌤️', text: "What's the weather like today?" },
    { emoji: '💡', text: 'Give me a creative idea' },
    { emoji: '📚', text: 'Recommend a book' },
    { emoji: '🍳', text: 'Suggest a quick recipe' },
    { emoji: '🎯', text: 'Help me stay motivated' },
  ];

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-primary/10 to-primary/5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-semibold">Nexora AI</h2>
              <p className="text-xs text-muted-foreground">
                {messages.length > 0 ? `${messages.length} messages` : 'Ask me anything'}
              </p>
            </div>
          </div>
        </div>
        {messages.length > 0 && (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={clearHistory}
            className="shrink-0 text-muted-foreground hover:text-destructive"
            title="Clear chat history"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {isLoadingHistory && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground text-sm">Loading conversation...</p>
          </div>
        )}
        
        {!isLoadingHistory && messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-primary-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Hi! I'm Nexora AI</h3>
            <p className="text-muted-foreground text-sm max-w-xs mb-6">
              I'm here to help you with questions, suggestions, and more!
            </p>
            
            {/* Quick Prompts */}
            <div className="w-full max-w-sm space-y-2">
              <p className="text-xs text-muted-foreground mb-3">Try asking:</p>
              <div className="grid grid-cols-2 gap-2">
                {quickPrompts.map((prompt, index) => (
                  <button
                    key={index}
                    onClick={() => sendMessage(prompt.text)}
                    className="flex items-center gap-2 px-3 py-2.5 bg-muted/50 hover:bg-muted rounded-xl text-left transition-colors border border-border/50"
                  >
                    <span className="text-lg">{prompt.emoji}</span>
                    <span className="text-sm text-foreground truncate">{prompt.text}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : 'bg-muted rounded-bl-md'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content || '...'}</p>
              </div>
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 rounded-full"
            disabled={isLoading}
            maxLength={10000}
          />
          <Button 
            type="submit" 
            size="icon" 
            className="rounded-full shrink-0"
            disabled={!input.trim() || isLoading}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
};

export default NexoraAIChat;
