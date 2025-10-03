import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

interface Contact {
  id: string;
  contact_user_id: string;
  contact_name: string | null;
  profiles: {
    display_name: string | null;
    phone_number: string | null;
    status: string | null;
    avatar_url: string | null;
  };
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
}

const phoneSchema = z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format");

const ContactsList = ({ onStartChat }: ContactsListProps) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [contactName, setContactName] = useState("");
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchContacts();
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

    // Fetch profile data for each contact
    if (data) {
      const contactsWithProfiles = await Promise.all(
        data.map(async (contact) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, phone_number, status, avatar_url')
            .eq('user_id', contact.contact_user_id)
            .single();

          return {
            ...contact,
            profiles: profile || {
              display_name: null,
              phone_number: null,
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
    if (!phoneNumber.trim()) {
      toast({
        title: "Error",
        description: "Please enter a phone number",
        variant: "destructive",
      });
      return;
    }

    try {
      phoneSchema.parse(phoneNumber);
    } catch {
      toast({
        title: "Invalid phone number",
        description: "Please use international format (e.g., +1234567890)",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Find user by phone number
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .eq('phone_number', phoneNumber.trim())
        .single();

      if (profileError || !profileData) {
        toast({
          title: "User not found",
          description: "No Nexora user found with this phone number",
          variant: "destructive",
        });
        return;
      }

      // Check if trying to add themselves
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      if (profileData.user_id === userData.user.id) {
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
          user_id: userData.user.id,
          contact_user_id: profileData.user_id,
          contact_name: contactName.trim() || profileData.display_name,
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
          description: `${contactName || profileData.display_name} has been added to your contacts`,
        });
        setPhoneNumber("");
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

  const filteredContacts = contacts.filter(contact => {
    const name = contact.contact_name || contact.profiles?.display_name || '';
    const phone = contact.profiles?.phone_number || '';
    const query = searchQuery.toLowerCase();
    return name.toLowerCase().includes(query) || phone.includes(query);
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

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Search Bar */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="🔍 Search or start new chat"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-muted/50 border-border rounded-full"
          />
        </div>
      </div>

      {/* Add Contact Button */}
      <div className="px-3 py-2 border-b border-border">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="w-full bg-primary hover:bg-primary-glow justify-start">
              <UserPlus className="w-4 h-4 mr-2" />
              Add New Contact
            </Button>
          </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Contact</DialogTitle>
                <DialogDescription>
                  Enter a phone number to find and add a Nexora user to your contacts
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+1234567890"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    maxLength={15}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the Nexora user's phone number
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

      {/* Contacts List */}
      <div className="flex-1 overflow-y-auto">
        {filteredContacts.length === 0 ? (
          <div className="text-center py-12 px-4">
            <p className="text-2xl mb-2">🔍</p>
            <p className="text-muted-foreground mb-4">
              {searchQuery ? "No contacts found" : "No contacts yet 📱"}
            </p>
            {!searchQuery && (
              <p className="text-sm text-muted-foreground">
                Add contacts by phone number to start chatting 💬
              </p>
            )}
          </div>
        ) : (
          filteredContacts.map((contact, index) => {
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
                    <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                      {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                    </span>
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
      </div>
    </div>
  );
};

export default ContactsList;
