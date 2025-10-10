import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, Camera, Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { Camera as CapacitorCamera } from '@capacitor/camera';
import { CameraResultType, CameraSource } from '@capacitor/camera';

interface Contact {
  id: string;
  contact_user_id: string;
  contact_name: string | null;
  profiles: {
    display_name: string | null;
  };
}

interface CreateGroupDialogProps {
  onGroupCreated: (conversationId: string, groupName: string) => void;
}

const groupSchema = z.object({
  groupName: z.string().trim().min(3, "Group name must be at least 3 characters").max(50, "Group name too long"),
  members: z.array(z.string()).min(1, "Select at least one member"),
});

const CreateGroupDialog = ({ onGroupCreated }: CreateGroupDialogProps) => {
  const [open, setOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupAvatarUrl, setGroupAvatarUrl] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchContacts();
    }
  }, [open]);

  const fetchContacts = async () => {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching contacts:', error);
      return;
    }

    if (data) {
      // Fetch profile data for each contact
      const contactsWithProfiles = await Promise.all(
        data.map(async (contact) => {
          const { data: profile } = await supabase
            .rpc('get_safe_profile', { profile_user_id: contact.contact_user_id });

          return {
            ...contact,
            profiles: {
              display_name: profile?.[0]?.display_name || null,
            },
          };
        })
      );
      setContacts(contactsWithProfiles);
    }
  };

  const handleImageUpload = async (source: 'camera' | 'gallery') => {
    try {
      setUploading(true);
      
      const image = await CapacitorCamera.getPhoto({
        quality: 80,
        allowEditing: true,
        resultType: CameraResultType.DataUrl,
        source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
        width: 500,
        height: 500
      });

      if (!image.dataUrl) {
        throw new Error('No image data received');
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const response = await fetch(image.dataUrl);
      const blob = await response.blob();
      
      const fileName = `group-${Date.now()}.${image.format}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, blob, {
          contentType: `image/${image.format}`,
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      setGroupAvatarUrl(publicUrl);

      toast({
        title: "Image uploaded",
        description: "Group icon has been set"
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const toggleMember = (userId: string) => {
    setSelectedMembers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const createGroup = async () => {
    try {
      groupSchema.parse({ groupName, members: selectedMembers });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      }
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.rpc('create_group_conversation', {
        p_group_name: groupName.trim(),
        p_member_ids: selectedMembers,
      });

      if (error) throw error;

      if (data && groupAvatarUrl) {
        await supabase
          .from('conversations')
          .update({ group_avatar_url: groupAvatarUrl })
          .eq('id', data);
      }

      toast({
        title: "Group created!",
        description: `${groupName} has been created with ${selectedMembers.length} members`,
      });

      onGroupCreated(data, groupName);
      setGroupName("");
      setGroupAvatarUrl("");
      setSelectedMembers([]);
      setOpen(false);
    } catch (error) {
      console.error('Error creating group:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create group",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="w-full justify-start">
          <Users className="w-4 h-4 mr-2" />
          Create Group
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Group Chat</DialogTitle>
          <DialogDescription>
            Create a group conversation with multiple contacts
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div className="flex flex-col items-center gap-3 p-4 bg-muted/30 rounded-lg">
            <Avatar className="w-20 h-20">
              {groupAvatarUrl ? (
                <img src={groupAvatarUrl} alt="Group" className="w-full h-full object-cover" />
              ) : (
                <AvatarFallback className="bg-primary text-primary-foreground">
                  <Users className="w-8 h-8" />
                </AvatarFallback>
              )}
            </Avatar>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleImageUpload('camera')}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <Camera className="w-3 h-3 mr-1" />
                )}
                Camera
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleImageUpload('gallery')}
                disabled={uploading}
              >
                <Upload className="w-3 h-3 mr-1" />
                Gallery
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="groupName">Group Name</Label>
            <Input
              id="groupName"
              type="text"
              placeholder="Enter group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={50}
            />
          </div>

          <div className="space-y-2">
            <Label>Select Members ({selectedMembers.length})</Label>
            <div className="border border-border rounded-lg max-h-64 overflow-y-auto">
              {contacts.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No contacts available. Add contacts first.
                </p>
              ) : (
                contacts.map((contact) => {
                  const displayName = contact.contact_name || contact.profiles?.display_name || 'Unknown';
                  const isSelected = selectedMembers.includes(contact.contact_user_id);
                  
                  return (
                    <div
                      key={contact.id}
                      className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer border-b border-border/50 last:border-0"
                      onClick={() => toggleMember(contact.contact_user_id)}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleMember(contact.contact_user_id)}
                      />
                      <div className="flex-1">
                        <p className="font-medium">{displayName}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <Button
            onClick={createGroup}
            disabled={loading || contacts.length === 0}
            className="w-full"
          >
            {loading ? "Creating..." : "Create Group"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateGroupDialog;
