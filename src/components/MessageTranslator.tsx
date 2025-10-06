import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Languages, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MessageTranslatorProps {
  messageId: string;
  messageText: string;
}

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
];

const MessageTranslator = ({ messageId, messageText }: MessageTranslatorProps) => {
  const [showTranslation, setShowTranslation] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [sourceLanguage, setSourceLanguage] = useState<string | null>(null);
  const [targetLanguage, setTargetLanguage] = useState<string>('en');
  const { toast } = useToast();

  const handleTranslate = async () => {
    if (translating) return;
    
    setTranslating(true);
    setShowTranslation(true);

    try {
      const { data, error } = await supabase.functions.invoke('translate-message', {
        body: {
          text: messageText,
          targetLanguage,
          messageId,
        },
      });

      if (error) throw error;

      if (data.limitReached) {
        toast({
          title: "Translation limit reached",
          description: data.message,
          variant: "destructive",
        });
        setShowTranslation(false);
        return;
      }

      setTranslatedText(data.translatedText);
      setSourceLanguage(data.sourceLanguage);
      
      toast({
        title: "Translated successfully",
        description: `Translated from ${data.sourceLanguage} to ${targetLanguage}`,
      });
    } catch (error) {
      console.error('Translation error:', error);
      toast({
        title: "Translation failed",
        description: error instanceof Error ? error.message : "Failed to translate message",
        variant: "destructive",
      });
      setShowTranslation(false);
    } finally {
      setTranslating(false);
    }
  };

  return (
    <div className="space-y-2">
      {!showTranslation ? (
        <div className="flex items-center gap-2">
          <Select value={targetLanguage} onValueChange={setTargetLanguage}>
            <SelectTrigger className="h-7 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleTranslate}
            disabled={translating}
            className="h-7 px-2 text-xs hover:bg-primary/10"
          >
            {translating ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <>
                <Languages className="w-3 h-3 mr-1" />
                Translate
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="bg-muted/50 rounded-lg p-3 space-y-2 border border-primary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Languages className="w-3 h-3" />
              <span>
                {sourceLanguage && `${sourceLanguage.toUpperCase()} → `}
                {targetLanguage.toUpperCase()}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTranslation(false)}
              className="h-6 w-6 p-0"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
          {translating ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Translating...</span>
            </div>
          ) : (
            <p className="text-sm">{translatedText}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default MessageTranslator;
