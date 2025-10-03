import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { FileText, Loader2, ListTodo, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ChatSummarizerProps {
  conversationId: string;
}

type SummaryType = 'bullets' | 'tldr' | 'action_items';

const ChatSummarizer = ({ conversationId }: ChatSummarizerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [summaries, setSummaries] = useState<Record<SummaryType, string | null>>({
    bullets: null,
    tldr: null,
    action_items: null,
  });
  const [metadata, setMetadata] = useState<{
    messageCount?: number;
    conversationStart?: string;
    conversationEnd?: string;
  } | null>(null);
  const { toast } = useToast();

  const generateSummary = async (type: SummaryType) => {
    if (summaries[type]) return; // Already generated

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('summarize-chat', {
        body: {
          conversationId,
          summaryType: type
        }
      });

      if (error) throw error;

      if (data?.summary) {
        setSummaries(prev => ({ ...prev, [type]: data.summary }));
        if (data.messageCount) {
          setMetadata({
            messageCount: data.messageCount,
            conversationStart: data.conversationStart,
            conversationEnd: data.conversationEnd
          });
        }
      }
    } catch (error) {
      console.error('Error generating summary:', error);
      toast({
        title: "Error",
        description: "Failed to generate summary. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTabChange = (value: string) => {
    const type = value as SummaryType;
    generateSummary(type);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileText className="w-4 h-4" />
          Summarize
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Chat Summary
          </DialogTitle>
          <DialogDescription>
            AI-powered conversation summaries and insights
          </DialogDescription>
        </DialogHeader>

        {metadata && (
          <div className="text-xs text-muted-foreground border-b pb-3">
            {metadata.messageCount} messages • {' '}
            {metadata.conversationStart && new Date(metadata.conversationStart).toLocaleDateString()} - {' '}
            {metadata.conversationEnd && new Date(metadata.conversationEnd).toLocaleDateString()}
          </div>
        )}

        <Tabs defaultValue="bullets" className="w-full" onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="bullets" className="gap-2">
              <FileText className="w-4 h-4" />
              Bullet Points
            </TabsTrigger>
            <TabsTrigger value="tldr" className="gap-2">
              <Zap className="w-4 h-4" />
              TL;DR
            </TabsTrigger>
            <TabsTrigger value="action_items" className="gap-2">
              <ListTodo className="w-4 h-4" />
              Action Items
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bullets" className="mt-4">
            <Card className="p-4">
              {isLoading && !summaries.bullets ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="ml-2 text-muted-foreground">Generating summary...</span>
                </div>
              ) : summaries.bullets ? (
                <div className="prose prose-sm max-w-none">
                  <div className="whitespace-pre-wrap">{summaries.bullets}</div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Click to generate bullet point summary
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="tldr" className="mt-4">
            <Card className="p-4">
              {isLoading && !summaries.tldr ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="ml-2 text-muted-foreground">Generating TL;DR...</span>
                </div>
              ) : summaries.tldr ? (
                <div className="prose prose-sm max-w-none">
                  <div className="whitespace-pre-wrap italic">{summaries.tldr}</div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Click to generate TL;DR summary
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="action_items" className="mt-4">
            <Card className="p-4">
              {isLoading && !summaries.action_items ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="ml-2 text-muted-foreground">Extracting action items...</span>
                </div>
              ) : summaries.action_items ? (
                <div className="prose prose-sm max-w-none">
                  <div className="whitespace-pre-wrap">{summaries.action_items}</div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Click to extract action items
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ChatSummarizer;
