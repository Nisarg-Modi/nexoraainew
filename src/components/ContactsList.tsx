import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, Users, Plus, Sparkles, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import CreateGroupDialog from "./CreateGroupDialog";
import NexoraAIChat from "./NexoraAIChat";
import { cn } from "@/lib/utils";
interface Contact {
  id: string;
  contact_user_id: string;
  contact_name: string | null;
  is_favourite: boolean;
  profiles: {
    display_name: string | null;
    status: string | null;
    avatar_url: string | null;
  };
}

interface GroupConversation {
  id: string;
  group_name: string;
  group_avatar_url: string | null;
  participant_count: number;
}

const avatarColors = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-orange-500',
  'bg-teal-500',
  'bg-indigo-500',
  'bg-red-500',
];

const contactEmojis = ['👋', '💬', '🎉', '✨', '🔥', '💡', '🚀', '🌟'];
const statusMessages = [
  'Hey there! 👋',
  'Available to chat 💬',
  'Busy right now ⏰',
  'At work 💼',
  'Sleeping 😴',
  'Online 🟢',
];

interface ContactsListProps {
  onStartChat: (contactUserId: string, contactName: string) => void;
  onStartGroupChat: (conversationId: string, groupName: string) => void;
}

const usernameSchema = z.string().trim().min(3, "Username must be at least 3 characters").max(30, "Username too long").regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores");

const ContactsList = ({ onStartChat, onStartGroupChat }: ContactsListProps) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<GroupConversation[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [username, setUsername] = useState("");
  const [contactName, setContactName] = useState("");
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'favourites' | 'groups'>('all');
  const [showAIChat, setShowAIChat] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchContacts();
    fetchGroups();
  }, []);

  const fetchContacts = async () => {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching contacts:', error);
      setContacts([]);
      return;
    }

    // Fetch profile data for each contact using secure function (excludes phone_number)
    if (data) {
      const contactsWithProfiles = await Promise.all(
        data.map(async (contact) => {
          const { data: profile } = await supabase
            .rpc('get_safe_profile', { profile_user_id: contact.contact_user_id });

          return {
            ...contact,
            is_favourite: contact.is_favourite || false,
            profiles: profile?.[0] || {
              display_name: null,
              status: null,
              avatar_url: null,
            },
          };
        })
      );
      setContacts(contactsWithProfiles);
    }
  };

  const addContact = async () => {
    if (!username.trim()) {
      toast({
        title: "Error",
        description: "Please enter a username",
        variant: "destructive",
      });
      return;
    }

    try {
      usernameSchema.parse(username);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Invalid username",
          description: error.errors[0].message,
          variant: "destructive",
        });
      }
      return;
    }

    setLoading(true);

    try {
      // Find user by username using secure function
      const { data: profileData, error: profileError } = await supabase
        .rpc('find_user_by_username', { input_username: username.trim() });

      if (profileError || !profileData || profileData.length === 0) {
        toast({
          title: "User not found",
          description: "No Nexora user found with this username",
          variant: "destructive",
        });
        return;
      }

      const userData = profileData[0];

      // Check if trying to add themselves
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser.user) return;

      if (userData.user_id === currentUser.user.id) {
        toast({
          title: "Cannot add yourself",
          description: "You cannot add yourself as a contact",
          variant: "destructive",
        });
        return;
      }

      const { error: contactError } = await supabase
        .from('contacts')
        .insert({
          user_id: currentUser.user.id,
          contact_user_id: userData.user_id,
          contact_name: contactName.trim() || userData.display_name,
        });

      if (contactError) {
        if (contactError.code === '23505') {
          toast({
            title: "Already added",
            description: "This contact is already in your list",
            variant: "destructive",
          });
        } else if (contactError.message?.toLowerCase().includes('rate limit') || 
                   contactError.message?.toLowerCase().includes('check_contact_rate_limit')) {
          toast({
            title: "Rate limit reached",
            description: "You've added 10 contacts in the last hour. Please try again later.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: "Failed to add contact. Please try again.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Contact added!",
          description: `${contactName || userData.display_name} has been added to your contacts`,
        });
        setUsername("");
        setContactName("");
        setDialogOpen(false);
        fetchContacts();
      }
    } catch (error) {
      console.error('Error adding contact:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data, error } = await supabase
        .from('conversation_participants')
        .select(`
          conversation_id,
          conversations!inner (
            id,
            group_name,
            group_avatar_url,
            is_group
          )
        `)
        .eq('user_id', userData.user.id);

      if (error) {
        console.error('Error fetching groups:', error);
        return;
      }

      if (data) {
        // Filter and format group conversations
        const groupConversations = await Promise.all(
          data
            .filter(item => item.conversations?.is_group)
            .map(async (item) => {
              const conv = item.conversations;
              
              // Count participants
              const { count } = await supabase
                .from('conversation_participants')
                .select('*', { count: 'exact', head: true })
                .eq('conversation_id', conv.id);

              return {
                id: conv.id,
                group_name: conv.group_name || 'Unnamed Group',
                group_avatar_url: conv.group_avatar_url,
                participant_count: count || 0,
              };
            })
        );
        setGroups(groupConversations);
      }
    } catch (error) {
      console.error('Error in fetchGroups:', error);
    }
  };

  const toggleFavourite = async (contactId: string, currentState: boolean, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering chat
    
    const { error } = await supabase
      .from('contacts')
      .update({ is_favourite: !currentState })
      .eq('id', contactId);

    if (error) {
      console.error('Error toggling favourite:', error);
      toast({
        title: 'Error',
        description: 'Failed to update favourite status',
        variant: 'destructive',
      });
      return;
    }

    // Update local state
    setContacts(prev => 
      prev.map(c => c.id === contactId ? { ...c, is_favourite: !currentState } : c)
    );
  };

  const filteredContacts = contacts.filter(contact => {
    const name = contact.contact_name || contact.profiles?.display_name || '';
    const query = searchQuery.toLowerCase();
    const matchesSearch = name.toLowerCase().includes(query);
    
    // Apply favourites filter
    if (activeFilter === 'favourites') {
      return matchesSearch && contact.is_favourite;
    }
    
    return matchesSearch;
  });

  const filteredGroups = groups.filter(group => {
    const query = searchQuery.toLowerCase();
    return group.group_name.toLowerCase().includes(query);
  });

  const getAvatarColor = (userId: string) => {
    const index = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return avatarColors[index % avatarColors.length];
  };

  const getRandomEmoji = (userId: string) => {
    const index = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return contactEmojis[index % contactEmojis.length];
  };

  const getStatusMessage = (userId: string) => {
    const index = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return statusMessages[index % statusMessages.length];
  };

  // Get display items based on active filter
  const getDisplayItems = () => {
    if (activeFilter === 'groups') {
      return { contacts: [], groups: filteredGroups };
    }
    return { contacts: filteredContacts, groups: [] };
  };

  const { contacts: displayContacts, groups: displayGroups } = getDisplayItems();

  const filterButtons = [
    { key: 'all' as const, label: 'All' },
    { key: 'unread' as const, label: 'Unread' },
    { key: 'favourites' as const, label: 'Favourites' },
    { key: 'groups' as const, label: 'Groups' },
  ];

  // Handle AI query submission
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      // Check if it looks like an AI query (starts with question words or contains "?")
      const aiTriggers = ['what', 'how', 'why', 'when', 'where', 'who', 'can', 'could', 'would', 'should', 'is', 'are', 'do', 'does', 'tell', 'explain', 'help'];
      const queryLower = searchQuery.toLowerCase().trim();
      const isAIQuery = queryLower.includes('?') || aiTriggers.some(trigger => queryLower.startsWith(trigger));
      
      if (isAIQuery) {
        setAiQuery(searchQuery);
        setShowAIChat(true);
        setSearchQuery('');
      }
    }
  };

  // Show AI Chat if active
  if (showAIChat) {
    return (
      <NexoraAIChat 
        onClose={() => {
          setShowAIChat(false);
          setAiQuery('');
        }} 
        initialQuery={aiQuery}
      />
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Search Bar */}
      <div className="px-4 pt-4 pb-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Ask Nexora AI or Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="pl-12 pr-12 h-12 bg-muted/30 border-0 rounded-full text-base placeholder:text-muted-foreground"
          />
          {/* AI Button */}
          <button
            onClick={() => {
              if (searchQuery.trim()) {
                setAiQuery(searchQuery);
                setShowAIChat(true);
                setSearchQuery('');
              } else {
                setShowAIChat(true);
              }
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center hover:opacity-90 transition-opacity"
          >
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </button>
        </div>
      </div>

      {/* Filter Pills */}
      <div className="px-4 pb-3 flex items-center gap-2 overflow-x-auto">
        {filterButtons.map((filter) => (
          <button
            key={filter.key}
            onClick={() => setActiveFilter(filter.key)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors border",
              activeFilter === filter.key
                ? "bg-primary/20 text-primary border-primary/30"
                : "bg-transparent text-foreground border-border hover:bg-muted/50"
            )}
          >
            {filter.label}
          </button>
        ))}
        
        {/* Add Button */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <button className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-muted/50 transition-colors flex-shrink-0">
              <Plus className="w-4 h-4 text-muted-foreground" />
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Contact</DialogTitle>
              <DialogDescription>
                Enter a username to find and add a Nexora user to your contacts
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  maxLength={30}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the Nexora user's username
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Contact Name (optional)</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  maxLength={50}
                />
              </div>
              <Button
                onClick={addContact}
                disabled={loading}
                className="w-full"
              >
                {loading ? "Adding..." : "Add Contact"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Create Group Button (shown only in groups filter) */}
      {activeFilter === 'groups' && (
        <div className="px-4 pb-3">
          <CreateGroupDialog 
            onGroupCreated={(conversationId, groupName) => {
              fetchGroups();
              onStartGroupChat(conversationId, groupName);
            }} 
          />
        </div>
      )}

      {/* Contact/Group List */}
      <div className="flex-1 overflow-y-auto">
        {/* Show Contacts */}
        {activeFilter !== 'groups' && (
          <>
            {displayContacts.length === 0 ? (
              <div className="text-center py-12 px-4">
                <p className="text-2xl mb-2">🔍</p>
                <p className="text-muted-foreground mb-4">
                  {searchQuery ? "No contacts found" : "No contacts yet 📱"}
                </p>
                {!searchQuery && (
                  <p className="text-sm text-muted-foreground">
                    Add contacts by username to start chatting 💬
                  </p>
                )}
              </div>
            ) : (
              displayContacts.map((contact, index) => {
                const displayName = contact.contact_name || contact.profiles?.display_name || 'Unknown';
                const emoji = getRandomEmoji(contact.contact_user_id);
                const statusMsg = contact.profiles?.status || getStatusMessage(contact.contact_user_id);
                const avatarColor = getAvatarColor(contact.contact_user_id);
                const unreadCount = index % 5 === 0 ? Math.floor(Math.random() * 5) + 1 : 0;
                
                return (
                  <div
                    key={contact.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer border-b border-border/50"
                    onClick={() => onStartChat(contact.contact_user_id, displayName)}
                  >
                    {/* Avatar */}
                    <Avatar className="w-12 h-12 flex-shrink-0">
                      <AvatarImage src={contact.profiles?.avatar_url || undefined} />
                      <AvatarFallback className={`${avatarColor} text-white font-semibold`}>
                        {displayName[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold truncate text-foreground">
                          {displayName} {emoji}
                        </h3>
                        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                          <span className="text-xs text-muted-foreground">
                            {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                          </span>
                          <button
                            onClick={(e) => toggleFavourite(contact.id, contact.is_favourite, e)}
                            className="p-1 hover:bg-muted/50 rounded-full transition-colors"
                          >
                            <Star 
                              className={cn(
                                "w-4 h-4 transition-colors",
                                contact.is_favourite 
                                  ? "fill-yellow-400 text-yellow-400" 
                                  : "text-muted-foreground hover:text-yellow-400"
                              )} 
                            />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground truncate flex-1">
                          {statusMsg}
                        </p>
                        {unreadCount > 0 && (
                          <Badge className="bg-accent text-accent-foreground rounded-full w-5 h-5 flex items-center justify-center p-0 text-xs ml-2">
                            {unreadCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}

        {/* Show Groups */}
        {activeFilter === 'groups' && (
          <>
            {displayGroups.length === 0 ? (
              <div className="text-center py-12 px-4">
                <p className="text-2xl mb-2">👥</p>
                <p className="text-muted-foreground mb-4">
                  {searchQuery ? "No groups found" : "No groups yet"}
                </p>
                {!searchQuery && (
                  <p className="text-sm text-muted-foreground">
                    Create a group to chat with multiple contacts
                  </p>
                )}
              </div>
            ) : (
              displayGroups.map((group) => {
                return (
                  <div
                    key={group.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer border-b border-border/50"
                    onClick={() => onStartGroupChat(group.id, group.group_name)}
                  >
                    {/* Avatar */}
                    <Avatar className="w-12 h-12 flex-shrink-0">
                      <AvatarImage src={group.group_avatar_url || undefined} />
                      <AvatarFallback className="bg-primary text-white font-semibold">
                        <Users className="w-6 h-6" />
                      </AvatarFallback>
                    </Avatar>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold truncate text-foreground">
                          {group.group_name}
                        </h3>
                        <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                          {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground truncate flex-1">
                          {group.participant_count} members
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ContactsList;
