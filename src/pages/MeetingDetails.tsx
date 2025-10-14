import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Calendar, Clock, Video, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import MeetingNotesSummary from "@/components/MeetingNotesSummary";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Meeting {
  id: string;
  title: string;
  description: string | null;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
  is_video: boolean;
}

interface Transcript {
  id: string;
  speaker_id: string;
  content: string;
  timestamp: string;
  translated_content: any;
  profiles: {
    display_name: string;
  };
}

const MeetingDetails = () => {
  const { meetingId } = useParams<{ meetingId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (meetingId) {
      fetchMeetingData();
    }
  }, [meetingId]);

  const fetchMeetingData = async () => {
    try {
      // Fetch meeting details
      const { data: meetingData, error: meetingError } = await supabase
        .from("meetings")
        .select("*")
        .eq("id", meetingId)
        .single();

      if (meetingError) throw meetingError;
      setMeeting(meetingData);

      // Fetch transcripts with profiles
      const { data: transcriptsData, error: transcriptsError } = await supabase
        .from("meeting_transcripts")
        .select("*")
        .eq("meeting_id", meetingId)
        .order("timestamp", { ascending: true });

      if (transcriptsError) throw transcriptsError;

      // Fetch profiles for all speakers
      const speakerIds = Array.from(new Set(transcriptsData?.map((t) => t.speaker_id) || []));
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", speakerIds);

      const profilesMap = new Map(
        profilesData?.map((p) => [p.user_id, p]) || []
      );

      // Combine transcripts with profiles
      const enrichedTranscripts = (transcriptsData || []).map((t) => ({
        ...t,
        profiles: profilesMap.get(t.speaker_id) || { display_name: "Unknown" },
      }));

      setTranscripts(enrichedTranscripts);
    } catch (error) {
      console.error("Error fetching meeting data:", error);
      toast({
        title: "Error",
        description: "Failed to load meeting data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading meeting...</p>
        </div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl mb-4">Meeting not found</p>
          <Button onClick={() => navigate("/meetings")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Meetings
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/meetings")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{meeting.title}</h1>
            {meeting.description && (
              <p className="text-muted-foreground mt-1">{meeting.description}</p>
            )}
          </div>
        </div>

        {/* Meeting Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Meeting Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span>{format(new Date(meeting.scheduled_start), "PPP")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span>
                {format(new Date(meeting.scheduled_start), "p")} -{" "}
                {format(new Date(meeting.scheduled_end), "p")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-muted-foreground" />
              <span>{meeting.is_video ? "Video Call" : "Audio Only"}</span>
            </div>
          </CardContent>
        </Card>

        {/* Transcripts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Transcripts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {transcripts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No transcripts available for this meeting</p>
              </div>
            ) : (
              <ScrollArea className="h-96">
                <div className="space-y-3">
                  {transcripts.map((transcript) => (
                    <div
                      key={transcript.id}
                      className="p-3 bg-muted rounded-lg space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {transcript.profiles?.display_name || "Unknown"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(transcript.timestamp), "p")}
                        </span>
                      </div>
                      <p className="text-sm">{transcript.content}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Meeting Summary */}
        {transcripts.length > 0 && <MeetingNotesSummary meetingId={meeting.id} />}
      </div>
    </div>
  );
};

export default MeetingDetails;
