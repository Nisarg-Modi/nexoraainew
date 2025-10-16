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
import { Calendar, Video, VideoOff, X, Search } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

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
  const [participantSearch, setParticipantSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ user_id: string; display_name: string; email?: string }>>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<Array<{ user_id: string; display_name: string; email?: string }>>([]);
  const [searching, setSearching] = useState(false);

  const handleSearchParticipants = async () => {
    if (!participantSearch.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      // Search by username or email
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, display_name, username")
        .or(`username.ilike.%${participantSearch}%,display_name.ilike.%${participantSearch}%`)
        .limit(5);

      if (profileError) throw profileError;

      // Get email addresses from auth.users (if available through RPC)
      const results = profileData?.map(p => ({
        user_id: p.user_id,
        display_name: p.display_name,
        email: p.username
      })) || [];

      setSearchResults(results);
    } catch (error) {
      console.error("Error searching participants:", error);
    } finally {
      setSearching(false);
    }
  };

  const addParticipant = (participant: { user_id: string; display_name: string; email?: string }) => {
    if (!selectedParticipants.find(p => p.user_id === participant.user_id)) {
      setSelectedParticipants([...selectedParticipants, participant]);
      setParticipantSearch("");
      setSearchResults([]);
    }
  };

  const removeParticipant = (userId: string) => {
    setSelectedParticipants(selectedParticipants.filter(p => p.user_id !== userId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (selectedParticipants.length === 0) {
      toast({
        title: "Participants Required",
        description: "Please add at least one participant to the meeting",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Generate unique meeting link
      const meetingId = crypto.randomUUID();
      const meetingLink = `${window.location.origin}/meeting/${meetingId}`;

      const { data: meeting, error } = await supabase.from("meetings").insert({
        title: formData.title,
        description: formData.description || null,
        scheduled_start: formData.scheduledStart,
        scheduled_end: formData.scheduledEnd,
        meeting_link: meetingLink,
        created_by: user.id,
        is_video: formData.isVideo,
        status: "scheduled",
      }).select().single();

      if (error) throw error;

      // Add participants to meeting_participants table
      if (meeting) {
        const participantInserts = selectedParticipants.map(p => ({
          meeting_id: meeting.id,
          user_id: p.user_id,
          status: 'invited'
        }));

        const { error: participantError } = await supabase
          .from("meeting_participants")
          .insert(participantInserts);

        if (participantError) throw participantError;
      }

      toast({
        title: "Meeting Created",
        description: `Meeting scheduled with ${selectedParticipants.length} participant${selectedParticipants.length > 1 ? 's' : ''}`,
      });

      setFormData({
        title: "",
        description: "",
        scheduledStart: "",
        scheduledEnd: "",
        isVideo: true,
      });
      setSelectedParticipants([]);
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

          <div className="space-y-2">
            <Label>Participants *</Label>
            <div className="relative">
              <div className="flex gap-2">
                <Input
                  placeholder="Search by username or email..."
                  value={participantSearch}
                  onChange={(e) => setParticipantSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearchParticipants();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleSearchParticipants}
                  disabled={searching}
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
              
              {searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {searchResults.map((result) => (
                    <button
                      key={result.user_id}
                      type="button"
                      className="w-full px-3 py-2 text-left hover:bg-accent transition-colors"
                      onClick={() => addParticipant(result)}
                    >
                      <div className="font-medium">{result.display_name}</div>
                      {result.email && (
                        <div className="text-sm text-muted-foreground">{result.email}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {selectedParticipants.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedParticipants.map((participant) => (
                  <Badge key={participant.user_id} variant="secondary" className="gap-1">
                    {participant.display_name}
                    <button
                      type="button"
                      onClick={() => removeParticipant(participant.user_id)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
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
