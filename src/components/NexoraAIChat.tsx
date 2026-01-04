import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Send, Sparkles, Trash2, Loader2, Plus, MessageSquare, ChevronLeft, Pencil, Check, X, Search, Download, FileText, FileJson } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

interface NexoraAIChatProps {
  onClose: () => void;
  initialQuery?: string;
}

const MAX_HISTORY_MESSAGES = 50;

const NexoraAIChat = ({ onClose, initialQuery }: NexoraAIChatProps) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [showConversationList, setShowConversationList] = useState(true);
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConversationIndex, setSelectedConversationIndex] = useState(-1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const processedInitialQuery = useRef(false);
  const isRequestInProgress = useRef(false);

  // Load conversations list
  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsLoadingConversations(false);
        return;
      }

      const { data, error } = await supabase
        .from('ai_chat_conversations')
        .select('id, title, updated_at')
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Failed to load conversations:', error);
      } else {
        setConversations(data || []);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setIsLoadingConversations(false);
    }
  };

  // Load messages for active conversation
  useEffect(() => {
    if (activeConversationId) {
      loadMessages(activeConversationId);
    }
  }, [activeConversationId]);

  const loadMessages = async (conversationId: string) => {
    setIsLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from('ai_chat_messages')
        .select('id, role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(MAX_HISTORY_MESSAGES);

      if (error) {
        console.error('Failed to load messages:', error);
      } else {
        setMessages(data?.map(m => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content
        })) || []);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Handle initial query - create new conversation
  useEffect(() => {
    if (initialQuery && !processedInitialQuery.current && !isRequestInProgress.current && !isLoadingConversations) {
      processedInitialQuery.current = true;
      const timer = setTimeout(async () => {
        const newConvId = await createConversation(initialQuery.slice(0, 50));
        if (newConvId) {
          setActiveConversationId(newConvId);
          setShowConversationList(false);
          // Wait for state to settle then send message
          setTimeout(() => sendMessage(initialQuery, newConvId), 100);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [initialQuery, isLoadingConversations]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Filter conversations for keyboard navigation
  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedConversationIndex(-1);
  }, [searchQuery]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when editing a conversation title
      if (editingConversationId) return;
      
      // Ctrl+N or Cmd+N - New chat
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        handleNewChat();
        return;
      }

      // Ctrl+K or Cmd+K - Focus search (only in conversation list)
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (showConversationList && searchInputRef.current) {
          searchInputRef.current.focus();
        }
        return;
      }

      // Escape - Clear search or go back to list
      if (e.key === 'Escape') {
        if (searchQuery) {
          setSearchQuery('');
          setSelectedConversationIndex(-1);
        } else if (!showConversationList) {
          handleBackToList();
        }
        return;
      }

      // Arrow navigation in conversation list
      if (showConversationList && filteredConversations.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedConversationIndex(prev => 
            prev < filteredConversations.length - 1 ? prev + 1 : prev
          );
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedConversationIndex(prev => prev > 0 ? prev - 1 : 0);
        } else if (e.key === 'Enter' && selectedConversationIndex >= 0) {
          e.preventDefault();
          const selectedConv = filteredConversations[selectedConversationIndex];
          if (selectedConv) {
            handleSelectConversation(selectedConv);
          }
        }
      }

      // Ctrl+/ or Cmd+/ - Focus message input (in chat view)
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        if (!showConversationList && messageInputRef.current) {
          messageInputRef.current.focus();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showConversationList, searchQuery, filteredConversations, selectedConversationIndex, editingConversationId]);

  const createConversation = async (title: string = 'New Chat'): Promise<string | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const { data, error } = await supabase
        .from('ai_chat_conversations')
        .insert({
          user_id: session.user.id,
          title: title.trim() || 'New Chat',
        })
        .select('id, title, updated_at')
        .single();

      if (error) {
        console.error('Failed to create conversation:', error);
        return null;
      }

      setConversations(prev => [data, ...prev]);
      return data.id;
    } catch (error) {
      console.error('Failed to create conversation:', error);
      return null;
    }
  };

  const updateConversationTitle = async (conversationId: string, title: string) => {
    try {
      const { error } = await supabase
        .from('ai_chat_conversations')
        .update({ title })
        .eq('id', conversationId);

      if (error) {
        throw error;
      }

      setConversations(prev =>
        prev.map(c => c.id === conversationId ? { ...c, title } : c)
      );
    } catch (error) {
      console.error('Failed to update conversation title:', error);
      toast({
        title: 'Error',
        description: 'Failed to rename conversation.',
        variant: 'destructive',
      });
    }
  };

  const startEditingConversation = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingConversationId(conv.id);
    setEditingTitle(conv.title);
    setTimeout(() => editInputRef.current?.focus(), 0);
  };

  const saveEditedTitle = async (conversationId: string) => {
    const trimmedTitle = editingTitle.trim();
    if (!trimmedTitle) {
      setEditingConversationId(null);
      return;
    }
    await updateConversationTitle(conversationId, trimmedTitle);
    setEditingConversationId(null);
  };

  const cancelEditing = () => {
    setEditingConversationId(null);
    setEditingTitle('');
  };

  const saveMessage = async (message: Message, conversationId: string): Promise<string | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const { data, error } = await supabase
        .from('ai_chat_messages')
        .insert({
          user_id: session.user.id,
          conversation_id: conversationId,
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

  const deleteConversation = useCallback(async (conversationId: string) => {
    try {
      const { error } = await supabase
        .from('ai_chat_conversations')
        .delete()
        .eq('id', conversationId);

      if (error) {
        console.error('Failed to delete conversation:', error);
        toast({
          title: 'Error',
          description: 'Failed to delete conversation.',
          variant: 'destructive',
        });
        return;
      }

      setConversations(prev => prev.filter(c => c.id !== conversationId));
      if (activeConversationId === conversationId) {
        setActiveConversationId(null);
        setMessages([]);
        setShowConversationList(true);
      }
      toast({
        title: 'Conversation deleted',
        description: 'The conversation has been removed.',
      });
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  }, [activeConversationId, toast]);

  const handleNewChat = async () => {
    const newConvId = await createConversation();
    if (newConvId) {
      setActiveConversationId(newConvId);
      setMessages([]);
      setShowConversationList(false);
    }
  };

  const handleSelectConversation = (conv: Conversation) => {
    setActiveConversationId(conv.id);
    setShowConversationList(false);
  };

  const handleBackToList = () => {
    setShowConversationList(true);
  };

  const exportConversation = useCallback(async (format: 'text' | 'json', conversationId?: string) => {
    try {
      const convId = conversationId || activeConversationId;
      if (!convId) return;

      const conv = conversations.find(c => c.id === convId);
      if (!conv) return;

      // Fetch messages for export
      const { data: messagesData, error } = await supabase
        .from('ai_chat_messages')
        .select('role, content, created_at')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const exportMessages = messagesData || [];
      let content: string;
      let filename: string;
      let mimeType: string;

      if (format === 'json') {
        const exportData = {
          title: conv.title,
          exported_at: new Date().toISOString(),
          messages: exportMessages.map(m => ({
            role: m.role,
            content: m.content,
            timestamp: m.created_at
          }))
        };
        content = JSON.stringify(exportData, null, 2);
        filename = `${conv.title.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.json`;
        mimeType = 'application/json';
      } else {
        const lines = [
          `# ${conv.title}`,
          `Exported: ${new Date().toLocaleString()}`,
          '',
          '---',
          '',
          ...exportMessages.map(m => {
            const role = m.role === 'user' ? 'You' : 'Nexora AI';
            const time = new Date(m.created_at).toLocaleString();
            return `[${time}] ${role}:\n${m.content}\n`;
          })
        ];
        content = lines.join('\n');
        filename = `${conv.title.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
        mimeType = 'text/plain';
      }

      // Create and download file
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Export successful',
        description: `Conversation exported as ${format.toUpperCase()}.`,
      });
    } catch (error) {
      console.error('Failed to export conversation:', error);
      toast({
        title: 'Export failed',
        description: 'Could not export the conversation.',
        variant: 'destructive',
      });
    }
  }, [activeConversationId, conversations, toast]);

  const sendMessage = async (messageText: string, conversationId?: string) => {
    if (!messageText.trim() || isLoading || isRequestInProgress.current) return;

    const targetConvId = conversationId || activeConversationId;
    if (!targetConvId) {
      toast({
        title: 'Error',
        description: 'Please select or create a conversation first.',
        variant: 'destructive',
      });
      return;
    }

    isRequestInProgress.current = true;

    if (messageText.length > 10000) {
      toast({
        title: 'Message too long',
        description: 'Please keep your message under 10,000 characters.',
        variant: 'destructive',
      });
      isRequestInProgress.current = false;
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast({
        title: 'Please sign in',
        description: 'You need to be signed in to use Nexora AI.',
        variant: 'destructive',
      });
      isRequestInProgress.current = false;
      return;
    }

    const userMessage: Message = { role: 'user', content: messageText.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Save user message and update title if first message
    saveMessage(userMessage, targetConvId);
    
    // Update conversation title based on first user message
    const currentConv = conversations.find(c => c.id === targetConvId);
    if (currentConv?.title === 'New Chat' && messages.length === 0) {
      const newTitle = messageText.slice(0, 40) + (messageText.length > 40 ? '...' : '');
      updateConversationTitle(targetConvId, newTitle);
    }

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
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      if (assistantContent) {
        saveMessage({ role: 'assistant', content: assistantContent }, targetConvId);
      }
    } catch (error) {
      console.error('Nexora AI error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to get AI response',
        variant: 'destructive',
      });
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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  // Conversation List View
  if (showConversationList) {
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
                  {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>
          <Button onClick={handleNewChat} size="sm" className="gap-1">
            <Plus className="w-4 h-4" />
            New
          </Button>
        </div>

        {/* Search Bar */}
        {conversations.length > 0 && !isLoadingConversations && (
          <div className="px-3 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations... (Ctrl+K)"
              className="pl-9 h-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearchQuery('')}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 px-1">
            Ctrl+N new chat • ↑↓ navigate • Enter select
          </p>
          </div>
        )}

        {/* Conversations List */}
        <ScrollArea className="flex-1">
          {isLoadingConversations ? (
            <div className="flex flex-col items-center justify-center h-full py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground text-sm">Loading conversations...</p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12 px-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-primary-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-2">No conversations yet</h3>
              <p className="text-muted-foreground text-sm max-w-xs mb-6">
                Start a new conversation with Nexora AI!
              </p>
              <Button onClick={handleNewChat} className="gap-2">
                <Plus className="w-4 h-4" />
                Start New Chat
              </Button>
            </div>
          ) : (() => {
            if (filteredConversations.length === 0 && searchQuery) {
              return (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <Search className="w-10 h-10 text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground text-sm">No conversations match "{searchQuery}"</p>
                  <Button variant="link" size="sm" onClick={() => setSearchQuery('')} className="mt-2">
                    Clear search
                  </Button>
                </div>
              );
            }
            
          return (
            <div className="p-2">
              {filteredConversations.map((conv, index) => (
                <div
                  key={conv.id}
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors group ${
                    selectedConversationIndex === index 
                      ? 'bg-primary/10 ring-1 ring-primary/30' 
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => editingConversationId !== conv.id && handleSelectConversation(conv)}
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <MessageSquare className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {editingConversationId === conv.id ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            saveEditedTitle(conv.id);
                          }}
                          className="flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Input
                            ref={editInputRef}
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            className="h-7 text-sm"
                            maxLength={50}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') cancelEditing();
                            }}
                          />
                          <Button type="submit" variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                            <Check className="w-4 h-4 text-primary" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={cancelEditing}>
                            <X className="w-4 h-4" />
                          </Button>
                        </form>
                      ) : (
                        <>
                          <p className="font-medium text-sm truncate">{conv.title}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(conv.updated_at)}</p>
                        </>
                      )}
                    </div>
                    {editingConversationId !== conv.id && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="shrink-0 text-muted-foreground hover:text-primary h-8 w-8"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onClick={() => exportConversation('text', conv.id)}>
                              <FileText className="w-4 h-4 mr-2" />
                              Export as Text
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => exportConversation('json', conv.id)}>
                              <FileJson className="w-4 h-4 mr-2" />
                              Export as JSON
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-muted-foreground hover:text-primary h-8 w-8"
                          onClick={(e) => startEditingConversation(conv, e)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-muted-foreground hover:text-destructive h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteConversation(conv.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
        </ScrollArea>
      </div>
    );
  }

  // Chat View
  const activeConv = conversations.find(c => c.id === activeConversationId);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-primary/10 to-primary/5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBackToList} className="shrink-0">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold truncate max-w-[180px]">
                {activeConv?.title || 'New Chat'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {messages.length > 0 ? `${messages.length} messages` : 'Start chatting'}
              </p>
            </div>
          </div>
        </div>
        {messages.length > 0 && (
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-primary"
                  title="Export conversation"
                >
                  <Download className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportConversation('text')}>
                  <FileText className="w-4 h-4 mr-2" />
                  Export as Text
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportConversation('json')}>
                  <FileJson className="w-4 h-4 mr-2" />
                  Export as JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => activeConversationId && deleteConversation(activeConversationId)}
              className="shrink-0 text-muted-foreground hover:text-destructive"
              title="Delete conversation"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {isLoadingMessages && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground text-sm">Loading messages...</p>
          </div>
        )}

        {!isLoadingMessages && messages.length === 0 && !isLoading && (
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
              key={message.id || index}
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
            ref={messageInputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message... (Ctrl+/ to focus)"
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
