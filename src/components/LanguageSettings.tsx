import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Languages, Loader2, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import TranslationHistory from "./TranslationHistory";

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'it', name: 'Italian', flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
  { code: 'nl', name: 'Dutch', flag: '🇳🇱' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
  { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
  { code: 'pl', name: 'Polish', flag: '🇵🇱' },
  { code: 'uk', name: 'Ukrainian', flag: '🇺🇦' },
  { code: 'vi', name: 'Vietnamese', flag: '🇻🇳' },
  { code: 'th', name: 'Thai', flag: '🇹🇭' },
  { code: 'id', name: 'Indonesian', flag: '🇮🇩' },
  { code: 'ms', name: 'Malay', flag: '🇲🇾' },
];

interface LanguageSettings {
  send_language: string;
  preferred_language: string;
  auto_translate: boolean;
}

export const LanguageSettings = () => {
  const [settings, setSettings] = useState<LanguageSettings>({
    send_language: 'en',
    preferred_language: 'en',
    auto_translate: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('send_language, preferred_language, auto_translate')
        .eq('user_id', userData.user.id)
        .single();

      if (error) throw error;

      if (data) {
        setSettings({
          send_language: data.send_language ?? 'en',
          preferred_language: data.preferred_language ?? 'en',
          auto_translate: data.auto_translate ?? false,
        });
      }
    } catch (error) {
      console.error('Error fetching language settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (updates: Partial<LanguageSettings>) => {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const newSettings = { ...settings, ...updates };

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', userData.user.id);

      if (error) throw error;

      setSettings(newSettings);

      const langName = LANGUAGES.find(l => 
        l.code === (updates.send_language || updates.preferred_language)
      )?.name;

      if ('auto_translate' in updates) {
        toast({
          title: updates.auto_translate ? "Auto-translate enabled" : "Auto-translate disabled",
          description: updates.auto_translate 
            ? "Incoming messages will be translated automatically"
            : "Messages will be shown in their original language",
        });
      } else if ('send_language' in updates) {
        toast({
          title: "Send language updated",
          description: `Your messages will be composed in ${langName}`,
        });
      } else if ('preferred_language' in updates) {
        toast({
          title: "Receive language updated",
          description: `Incoming messages will be translated to ${langName}`,
        });
      }
    } catch (error) {
      console.error('Error updating language settings:', error);
      toast({
        title: "Error",
        description: "Failed to update language settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 bg-card rounded-lg border border-border">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Languages className="w-5 h-5 text-primary" />
          Language Preferences
        </h3>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <History className="w-4 h-4" />
              History
            </Button>
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-lg">
            <SheetHeader>
              <SheetTitle>Translation History</SheetTitle>
            </SheetHeader>
            <div className="mt-6">
              <TranslationHistory />
            </div>
          </SheetContent>
        </Sheet>
      </div>
      
      {/* Send Language */}
      <div className="space-y-2">
        <Label htmlFor="send-language" className="text-sm font-medium">
          Send messages in
        </Label>
        <Select
          value={settings.send_language}
          onValueChange={(value) => updateSettings({ send_language: value })}
          disabled={saving}
        >
          <SelectTrigger id="send-language" className="w-full bg-background">
            <SelectValue placeholder="Select language" />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((lang) => (
              <SelectItem key={lang.code} value={lang.code}>
                <span className="flex items-center gap-2">
                  <span>{lang.flag}</span>
                  <span>{lang.name}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Your default language for composing messages
        </p>
      </div>

      {/* Auto-translate toggle */}
      <div className="flex items-center justify-between pt-2">
        <div className="space-y-0.5">
          <Label htmlFor="auto-translate" className="text-base">
            Auto-translate messages
          </Label>
          <p className="text-sm text-muted-foreground">
            Automatically translate incoming messages
          </p>
        </div>
        <Switch
          id="auto-translate"
          checked={settings.auto_translate}
          onCheckedChange={(checked) => updateSettings({ auto_translate: checked })}
          disabled={saving}
        />
      </div>

      {/* Receive Language */}
      {settings.auto_translate && (
        <div className="space-y-2 pt-2 border-t border-border/50">
          <Label htmlFor="receive-language" className="text-sm font-medium">
            Translate incoming messages to
          </Label>
          <Select
            value={settings.preferred_language}
            onValueChange={(value) => updateSettings({ preferred_language: value })}
            disabled={saving}
          >
            <SelectTrigger id="receive-language" className="w-full bg-background">
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  <span className="flex items-center gap-2">
                    <span>{lang.flag}</span>
                    <span>{lang.name}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Messages will be automatically translated to this language
          </p>
        </div>
      )}
    </div>
  );
};
