import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar, Plus, Video, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import CreateMeetingDialog from "@/components/CreateMeetingDialog";
import MeetingCard from "@/components/MeetingCard";

interface Meeting {
  id: string;
  title: string;
  description: string | null;
  scheduled_start: string;
  scheduled_end: string;
  meeting_link: string;
  status: string;
  is_video: boolean;
  created_by: string;
  participants?: Array<{
    user_id: string;
    status: string;
    profiles: {
      display_name: string;
      avatar_url: string | null;
    };
  }>;
}

const Meetings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  useEffect(() => {
    if (user) {
      fetchMeetings();
    }
  }, [user]);

  const fetchMeetings = async () => {
    try {
      const { data, error } = await supabase
        .from("meetings")
        .select(`
          *,
          participants:meeting_participants(
            user_id,
            status,
            profiles(display_name, avatar_url)
          )
        `)
        .order("scheduled_start", { ascending: true });

      if (error) throw error;
      setMeetings(data || []);
    } catch (error) {
      console.error("Error fetching meetings:", error);
      toast({
        title: "Error",
        description: "Failed to load meetings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const upcomingMeetings = meetings.filter(
    (m) => m.status === "scheduled" && new Date(m.scheduled_start) > new Date()
  );
  const pastMeetings = meetings.filter(
    (m) => m.status === "ended" || new Date(m.scheduled_end) < new Date()
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading meetings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Calendar className="w-8 h-8 text-primary" />
              Meetings
            </h1>
            <p className="text-muted-foreground mt-1">
              Schedule and manage your video meetings
            </p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} size="lg">
            <Plus className="w-5 h-5 mr-2" />
            Schedule Meeting
          </Button>
        </div>

        {/* Upcoming Meetings */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">
              Upcoming ({upcomingMeetings.length})
            </h2>
          </div>
          
          {upcomingMeetings.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <Video className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No upcoming meetings</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setShowCreateDialog(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Schedule Your First Meeting
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {upcomingMeetings.map((meeting) => (
                <MeetingCard
                  key={meeting.id}
                  meeting={meeting}
                  onUpdate={fetchMeetings}
                />
              ))}
            </div>
          )}
        </div>

        {/* Past Meetings */}
        {pastMeetings.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Past Meetings</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {pastMeetings.map((meeting) => (
                <MeetingCard
                  key={meeting.id}
                  meeting={meeting}
                  onUpdate={fetchMeetings}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <CreateMeetingDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={fetchMeetings}
      />
    </div>
  );
};

export default Meetings;
