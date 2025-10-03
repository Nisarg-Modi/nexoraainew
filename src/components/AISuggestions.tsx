import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AISuggestionsProps {
  currentText: string;
  onSelectSuggestion: (text: string) => void;
  onClose: () => void;
}

type Tone = "professional" | "casual" | "witty" | "empathetic";

const toneExamples: Record<Tone, string> = {
  professional: "I appreciate your message and would like to discuss this further at your earliest convenience.",
  casual: "Hey! Yeah, that sounds great. Let me know when works for you!",
  witty: "Well, well, well... look who's back! Count me in, this should be interesting 😄",
  empathetic: "I completely understand where you're coming from. Let's find a time to talk through this together.",
};

const AISuggestions = ({ currentText, onSelectSuggestion, onClose }: AISuggestionsProps) => {
  const [selectedTone, setSelectedTone] = useState<Tone>("casual");

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
      <Card className="p-3 mb-4 bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/30 cursor-pointer hover:border-primary/50 transition-all glow-hover"
            onClick={() => onSelectSuggestion(toneExamples[selectedTone])}>
        <div className="flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm">{toneExamples[selectedTone]}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Click to use · Generated with {selectedTone} tone
            </p>
          </div>
        </div>
      </Card>

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
