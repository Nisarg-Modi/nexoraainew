import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  Clock,
  Video,
  Copy,
  Download,
  Trash2,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface MeetingCardProps {
  meeting: {
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
  };
  onUpdate: () => void;
}

const MeetingCard = ({ meeting, onUpdate }: MeetingCardProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const startDate = new Date(meeting.scheduled_start);
  const endDate = new Date(meeting.scheduled_end);
  const isPast = endDate < new Date();

  const copyMeetingLink = () => {
    navigator.clipboard.writeText(meeting.meeting_link);
    toast({
      title: "Link Copied",
      description: "Meeting link copied to clipboard",
    });
  };

  const downloadICS = () => {
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Nexora//Meeting//EN
BEGIN:VEVENT
UID:${meeting.id}@nexora
DTSTAMP:${format(new Date(), "yyyyMMdd'T'HHmmss'Z'")}
DTSTART:${format(startDate, "yyyyMMdd'T'HHmmss'Z'")}
DTEND:${format(endDate, "yyyyMMdd'T'HHmmss'Z'")}
SUMMARY:${meeting.title}
DESCRIPTION:${meeting.description || "Join the meeting: " + meeting.meeting_link}
URL:${meeting.meeting_link}
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], {
      type: "text/calendar;charset=utf-8",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${meeting.title.replace(/\s+/g, "_")}.ics`;
    link.click();

    toast({
      title: "Calendar Invite Downloaded",
      description: "Add this event to your calendar",
    });
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("meetings")
        .delete()
        .eq("id", meeting.id);

      if (error) throw error;

      toast({
        title: "Meeting Deleted",
        description: "The meeting has been cancelled",
      });
      onUpdate();
    } catch (error) {
      console.error("Error deleting meeting:", error);
      toast({
        title: "Error",
        description: "Failed to delete meeting",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const joinMeeting = () => {
    // Extract meeting ID from link
    const meetingId = meeting.meeting_link.split("/meeting/")[1];
    navigate(`/meeting/${meetingId}`);
  };

  return (
    <>
      <Card className={isPast ? "opacity-60" : ""}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1">
              <CardTitle className="text-lg">{meeting.title}</CardTitle>
              {meeting.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {meeting.description}
                </p>
              )}
            </div>
            <Badge variant={isPast ? "secondary" : "default"}>
              {meeting.status}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span>{format(startDate, "PPP")}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span>
                {format(startDate, "p")} - {format(endDate, "p")}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Video className="w-4 h-4 text-muted-foreground" />
              <span>{meeting.is_video ? "Video Call" : "Audio Only"}</span>
            </div>
          </div>

          {meeting.participants && meeting.participants.length > 0 && (
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <div className="flex -space-x-2">
                {meeting.participants.slice(0, 3).map((participant) => (
                  <Avatar key={participant.user_id} className="w-6 h-6 border-2 border-background">
                    <AvatarImage src={participant.profiles.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {participant.profiles.display_name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {meeting.participants.length > 3 && (
                  <div className="w-6 h-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs">
                    +{meeting.participants.length - 3}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            {!isPast && (
              <Button onClick={joinMeeting} className="flex-1">
                <Video className="w-4 h-4 mr-2" />
                Join
              </Button>
            )}
            <Button variant="outline" size="icon" onClick={copyMeetingLink}>
              <Copy className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={downloadICS}>
              <Download className="w-4 h-4" />
            </Button>
            {!isPast && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Meeting?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the meeting and notify all participants. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete Meeting"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default MeetingCard;
