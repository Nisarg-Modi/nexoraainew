import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface CreateStreamDialogProps {
  onStreamCreated: () => void;
}

export const CreateStreamDialog = ({ onStreamCreated }: CreateStreamDialogProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();

  const handleSubmit = async () => {
    if (!user) {
      toast.error("You must be logged in");
      return;
    }

    if (!name.trim()) {
      toast.error("Stream name is required");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('streams')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          created_by: user.id,
        });

      if (error) throw error;

      toast.success("Stream created!");
      setName("");
      setDescription("");
      setOpen(false);
      onStreamCreated();
    } catch (error: any) {
      console.error("Error creating stream:", error);
      toast.error(error.message || "Failed to create stream");
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
          <DialogTitle>Create a Stream</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Stream Name</Label>
            <Input
              id="name"
              placeholder="e.g., Tech Updates"
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
              placeholder="What will you broadcast about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-2 min-h-[80px]"
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">
              {description.length}/200
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            Create a broadcast channel where followers can see your updates.
          </p>

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
                "Create Stream"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
