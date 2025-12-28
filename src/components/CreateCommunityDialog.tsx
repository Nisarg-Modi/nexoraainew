import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface CreateCommunityDialogProps {
  onCommunityCreated: () => void;
}

export const CreateCommunityDialog = ({ onCommunityCreated }: CreateCommunityDialogProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();

  const handleSubmit = async () => {
    if (!user) {
      toast.error("You must be logged in");
      return;
    }

    if (!name.trim()) {
      toast.error("Community name is required");
      return;
    }

    setIsSubmitting(true);

    try {
      // Create the community
      const { data: community, error: communityError } = await supabase
        .from('communities')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          created_by: user.id,
          is_public: isPublic,
        })
        .select()
        .single();

      if (communityError) throw communityError;

      // Add creator as owner
      const { error: memberError } = await supabase
        .from('community_members')
        .insert({
          community_id: community.id,
          user_id: user.id,
          role: 'owner',
        });

      if (memberError) throw memberError;

      toast.success("Community created!");
      setName("");
      setDescription("");
      setIsPublic(true);
      setOpen(false);
      onCommunityCreated();
    } catch (error: any) {
      console.error("Error creating community:", error);
      toast.error(error.message || "Failed to create community");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Create
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a Community</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Community Name</Label>
            <Input
              id="name"
              placeholder="e.g., Tech Enthusiasts"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2"
              maxLength={50}
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="What's your community about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-2 min-h-[80px]"
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">
              {description.length}/200
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="public">Public Community</Label>
              <p className="text-xs text-muted-foreground">
                Anyone can discover and join
              </p>
            </div>
            <Switch
              id="public"
              checked={isPublic}
              onCheckedChange={setIsPublic}
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Community"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
