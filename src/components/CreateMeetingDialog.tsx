import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Video, VideoOff } from "lucide-react";
import { format } from "date-fns";

interface CreateMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const CreateMeetingDialog = ({
  open,
  onOpenChange,
  onSuccess,
}: CreateMeetingDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    scheduledStart: "",
    scheduledEnd: "",
    isVideo: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      // Generate unique meeting link
      const meetingId = crypto.randomUUID();
      const meetingLink = `${window.location.origin}/meeting/${meetingId}`;

      const { error } = await supabase.from("meetings").insert({
        title: formData.title,
        description: formData.description || null,
        scheduled_start: formData.scheduledStart,
        scheduled_end: formData.scheduledEnd,
        meeting_link: meetingLink,
        created_by: user.id,
        is_video: formData.isVideo,
        status: "scheduled",
      });

      if (error) throw error;

      toast({
        title: "Meeting Created",
        description: "Your meeting has been scheduled successfully",
      });

      setFormData({
        title: "",
        description: "",
        scheduledStart: "",
        scheduledEnd: "",
        isVideo: true,
      });
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Error creating meeting:", error);
      toast({
        title: "Error",
        description: "Failed to create meeting",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Schedule a Meeting
          </DialogTitle>
          <DialogDescription>
            Create a new video or audio meeting with participants
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Meeting Title *</Label>
            <Input
              id="title"
              placeholder="Team standup, Client call, etc."
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Meeting agenda or notes..."
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start">Start Time *</Label>
              <Input
                id="start"
                type="datetime-local"
                value={formData.scheduledStart}
                onChange={(e) =>
                  setFormData({ ...formData, scheduledStart: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end">End Time *</Label>
              <Input
                id="end"
                type="datetime-local"
                value={formData.scheduledEnd}
                onChange={(e) =>
                  setFormData({ ...formData, scheduledEnd: e.target.value })
                }
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              {formData.isVideo ? (
                <Video className="w-5 h-5 text-primary" />
              ) : (
                <VideoOff className="w-5 h-5 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium">Video Call</p>
                <p className="text-sm text-muted-foreground">
                  {formData.isVideo ? "Video enabled" : "Audio only"}
                </p>
              </div>
            </div>
            <Switch
              checked={formData.isVideo}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, isVideo: checked })
              }
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Schedule Meeting"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateMeetingDialog;
