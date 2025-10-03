import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { UserPlus, MessageCircle, Search } from "lucide-react";
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
          description: "No Mercury user found with this phone number",
          variant: "destructive",
        });
        return;
      }

      // Add contact
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

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

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold gradient-text">Contacts</h2>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-primary hover:bg-primary-glow">
                <UserPlus className="w-4 h-4 mr-2" />
                Add Contact
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Contact</DialogTitle>
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
                    Enter the Mercury user's phone number
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

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-muted border-border"
          />
        </div>
      </div>

      {/* Contacts List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filteredContacts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              {searchQuery ? "No contacts found" : "No contacts yet"}
            </p>
            {!searchQuery && (
              <p className="text-sm text-muted-foreground">
                Add contacts by their phone number to start chatting
              </p>
            )}
          </div>
        ) : (
          filteredContacts.map((contact) => (
            <Card
              key={contact.id}
              className="p-4 hover:bg-primary/5 transition-colors cursor-pointer"
              onClick={() => onStartChat(
                contact.contact_user_id,
                contact.contact_name || contact.profiles?.display_name || 'Unknown'
              )}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0">
                  <span className="font-semibold text-lg">
                    {(contact.contact_name || contact.profiles?.display_name || '?')[0].toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">
                    {contact.contact_name || contact.profiles?.display_name || 'Unknown'}
                  </h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {contact.profiles?.status || contact.profiles?.phone_number || 'Hey there! I am using Mercury'}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartChat(
                      contact.contact_user_id,
                      contact.contact_name || contact.profiles?.display_name || 'Unknown'
                    );
                  }}
                >
                  <MessageCircle className="w-5 h-5 text-primary" />
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default ContactsList;
