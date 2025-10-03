import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  sender: string;
  text: string;
}

interface AISuggestionsProps {
  currentText: string;
  conversationContext: Message[];
  onSelectSuggestion: (text: string) => void;
  onClose: () => void;
}

type Tone = "professional" | "casual" | "witty" | "empathetic";

interface Suggestion {
  tone: Tone;
  text: string;
}

const AISuggestions = ({ currentText, conversationContext, onSelectSuggestion, onClose }: AISuggestionsProps) => {
  const [selectedTone, setSelectedTone] = useState<Tone>("casual");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (conversationContext.length > 0) {
      fetchSuggestions();
    }
  }, [conversationContext]);

  const fetchSuggestions = async () => {
    setIsLoading(true);
    try {
      const lastMessages = conversationContext.slice(-5);
      const { data, error } = await supabase.functions.invoke('generate-reply-suggestions', {
        body: {
          conversationContext: lastMessages,
          currentMessage: conversationContext[conversationContext.length - 1]?.text || ''
        }
      });

      if (error) throw error;
      
      if (data?.suggestions && data.suggestions.length > 0) {
        setSuggestions(data.suggestions);
      }
    } catch (error) {
      console.error('Error fetching AI suggestions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const currentSuggestion = suggestions.find(s => s.tone === selectedTone);

  const quickReplies = [
    "Sounds good!",
    "Let me think about it",
    "Thanks for letting me know",
    "Can we discuss this later?",
  ];

  return (
    <div className="bg-card border-t border-border p-4 animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary animate-glow-pulse" />
          <h3 className="font-semibold">Nexora AI Assistant</h3>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Tone Shifter */}
      <div className="mb-4">
        <p className="text-sm text-muted-foreground mb-2">Tone Shift:</p>
        <div className="flex gap-2 flex-wrap">
          {(["professional", "casual", "witty", "empathetic"] as Tone[]).map((tone) => (
            <Button
              key={tone}
              variant={selectedTone === tone ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedTone(tone)}
              className={cn(
                "capitalize transition-all",
                selectedTone === tone && "glow-ai"
              )}
            >
              {tone}
            </Button>
          ))}
        </div>
      </div>

      {/* AI Generated Response */}
      {isLoading ? (
        <Card className="p-3 mb-4 bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/30">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">AI is generating suggestions...</p>
          </div>
        </Card>
      ) : currentSuggestion ? (
        <Card 
          className="p-3 mb-4 bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/30 cursor-pointer hover:border-primary/50 transition-all glow-hover"
          onClick={() => onSelectSuggestion(currentSuggestion.text)}
        >
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm">{currentSuggestion.text}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Click to use · Generated with {selectedTone} tone
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {/* Quick Replies */}
      <div>
        <p className="text-sm text-muted-foreground mb-2">Quick Replies:</p>
        <div className="flex gap-2 flex-wrap">
          {quickReplies.map((reply, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              onClick={() => onSelectSuggestion(reply)}
              className="hover:bg-primary/10 hover:border-primary/50"
            >
              {reply}
            </Button>
          ))}
        </div>
      </div>

      {/* Translation Hint */}
      {currentText.length > 10 && (
        <div className="mt-4 p-3 bg-secondary/10 border border-secondary/30 rounded-lg">
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <span className="text-secondary">🌐</span>
            Live Translation available · Tap to translate to Spanish, French, German, or 40+ languages
          </p>
        </div>
      )}
    </div>
  );
};

export default AISuggestions;
