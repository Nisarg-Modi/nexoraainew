import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MeetingNotesSummaryProps {
  meetingId: string;
}

type SummaryType = "bullets" | "tldr" | "action_items";

const MeetingNotesSummary = ({ meetingId }: MeetingNotesSummaryProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState<Record<SummaryType, boolean>>({
    bullets: false,
    tldr: false,
    action_items: false,
  });
  const [summaries, setSummaries] = useState<Record<SummaryType, string | null>>({
    bullets: null,
    tldr: null,
    action_items: null,
  });

  const generateSummary = async (type: SummaryType) => {
    setLoading((prev) => ({ ...prev, [type]: true }));
    try {
      // Fetch all transcripts for this meeting
      const { data: transcripts, error: transcriptsError } = await supabase
        .from("meeting_transcripts")
        .select("*")
        .eq("meeting_id", meetingId)
        .order("timestamp", { ascending: true });

      if (transcriptsError) throw transcriptsError;

      if (!transcripts || transcripts.length === 0) {
        toast({
          title: "No Transcripts",
          description: "There are no transcripts to summarize yet.",
        });
        return;
      }

      // Format transcripts for summarization
      const formattedTranscripts = transcripts
        .map((t) => `[${new Date(t.timestamp).toLocaleTimeString()}] ${t.content}`)
        .join("\n");

      // Call summarize-chat function with appropriate system prompt
      const systemPrompts = {
        bullets: "Summarize the following meeting transcript into clear bullet points highlighting key topics discussed:",
        tldr: "Provide a concise TL;DR summary of the following meeting transcript:",
        action_items: "Extract and list all action items and next steps from the following meeting transcript:",
      };

      const { data, error } = await supabase.functions.invoke("summarize-chat", {
        body: {
          conversationId: meetingId,
          type: "custom",
          customPrompt: `${systemPrompts[type]}\n\n${formattedTranscripts}`,
        },
      });

      if (error) throw error;

      setSummaries((prev) => ({ ...prev, [type]: data.summary }));
      toast({
        title: "Summary Generated",
        description: "Meeting summary has been created successfully",
      });
    } catch (error) {
      console.error("Error generating summary:", error);
      toast({
        title: "Error",
        description: "Failed to generate summary",
        variant: "destructive",
      });
    } finally {
      setLoading((prev) => ({ ...prev, [type]: false }));
    }
  };

  const renderSummaryTab = (type: SummaryType, title: string) => (
    <TabsContent value={type} className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          {summaries[type] ? (
            <div className="prose prose-sm max-w-none">
              <p className="whitespace-pre-wrap">{summaries[type]}</p>
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground mb-4">No summary generated yet</p>
              <Button
                onClick={() => generateSummary(type)}
                disabled={loading[type]}
              >
                {loading[type] && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Generate {title}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Meeting Notes & Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="bullets">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="bullets">Bullet Points</TabsTrigger>
            <TabsTrigger value="tldr">TL;DR</TabsTrigger>
            <TabsTrigger value="action_items">Action Items</TabsTrigger>
          </TabsList>

          {renderSummaryTab("bullets", "Bullet Points")}
          {renderSummaryTab("tldr", "TL;DR")}
          {renderSummaryTab("action_items", "Action Items")}
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default MeetingNotesSummary;
