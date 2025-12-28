import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Languages, Loader2, X } from "lucide-react";
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
  SheetDescription,
} from "@/components/ui/sheet";

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

interface ContactLanguagePreferencesProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactUserId: string;
  contactName: string;
  conversationId?: string;
}

interface Preferences {
  auto_translate: boolean;
  preferred_language: string;
  send_language: string;
  use_custom: boolean;
}

export const ContactLanguagePreferences = ({
  open,
  onOpenChange,
  contactUserId,
  contactName,
  conversationId,
}: ContactLanguagePreferencesProps) => {
  const [preferences, setPreferences] = useState<Preferences>({
    auto_translate: false,
    preferred_language: 'en',
    send_language: 'en',
    use_custom: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchPreferences();
    }
  }, [open, contactUserId]);

  const fetchPreferences = async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data, error } = await supabase
        .from('contact_language_preferences')
        .select('*')
        .eq('user_id', userData.user.id)
        .eq('contact_user_id', contactUserId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setPreferences({
          auto_translate: data.auto_translate ?? false,
          preferred_language: data.preferred_language ?? 'en',
          send_language: data.send_language ?? 'en',
          use_custom: true,
        });
      } else {
        // Load global preferences as default
        const { data: profile } = await supabase
          .from('profiles')
          .select('auto_translate, preferred_language, send_language')
          .eq('user_id', userData.user.id)
          .single();

        if (profile) {
          setPreferences({
            auto_translate: profile.auto_translate ?? false,
            preferred_language: profile.preferred_language ?? 'en',
            send_language: profile.send_language ?? 'en',
            use_custom: false,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching contact language preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePreferences = async (updates: Partial<Preferences>) => {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const newPreferences = { ...preferences, ...updates, use_custom: true };

      const { error } = await supabase
        .from('contact_language_preferences')
        .upsert({
          user_id: userData.user.id,
          contact_user_id: contactUserId,
          conversation_id: conversationId,
          auto_translate: newPreferences.auto_translate,
          preferred_language: newPreferences.preferred_language,
          send_language: newPreferences.send_language,
        }, {
          onConflict: 'user_id,contact_user_id'
        });

      if (error) throw error;

      setPreferences(newPreferences);

      toast({
        title: "Preferences saved",
        description: `Language settings updated for ${contactName}`,
      });
    } catch (error) {
      console.error('Error updating contact language preferences:', error);
      toast({
        title: "Error",
        description: "Failed to update language preferences",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const resetToGlobal = async () => {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      // Delete the custom preferences
      const { error } = await supabase
        .from('contact_language_preferences')
        .delete()
        .eq('user_id', userData.user.id)
        .eq('contact_user_id', contactUserId);

      if (error) throw error;

      // Load global preferences
      const { data: profile } = await supabase
        .from('profiles')
        .select('auto_translate, preferred_language, send_language')
        .eq('user_id', userData.user.id)
        .single();

      if (profile) {
        setPreferences({
          auto_translate: profile.auto_translate ?? false,
          preferred_language: profile.preferred_language ?? 'en',
          send_language: profile.send_language ?? 'en',
          use_custom: false,
        });
      }

      toast({
        title: "Reset to global",
        description: "Using global language settings for this contact",
      });
    } catch (error) {
      console.error('Error resetting preferences:', error);
      toast({
        title: "Error",
        description: "Failed to reset preferences",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md">
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Languages className="w-5 h-5 text-primary" />
            Language Settings for {contactName}
          </SheetTitle>
          <SheetDescription>
            {preferences.use_custom
              ? "Custom settings override your global preferences"
              : "Using global language settings"}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Custom indicator */}
          {preferences.use_custom && (
            <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
              <span className="text-sm font-medium">Custom settings active</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetToGlobal}
                disabled={saving}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4 mr-1" />
                Reset to global
              </Button>
            </div>
          )}

          {/* Auto-translate toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="contact-auto-translate" className="text-base">
                Auto-translate messages
              </Label>
              <p className="text-sm text-muted-foreground">
                Automatically translate messages from {contactName}
              </p>
            </div>
            <Switch
              id="contact-auto-translate"
              checked={preferences.auto_translate}
              onCheckedChange={(checked) => updatePreferences({ auto_translate: checked })}
              disabled={saving}
            />
          </div>

          {/* Receive Language */}
          {preferences.auto_translate && (
            <div className="space-y-2 pt-2 border-t border-border/50">
              <Label htmlFor="contact-receive-language" className="text-sm font-medium">
                Translate messages to
              </Label>
              <Select
                value={preferences.preferred_language}
                onValueChange={(value) => updatePreferences({ preferred_language: value })}
                disabled={saving}
              >
                <SelectTrigger id="contact-receive-language" className="w-full bg-background">
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
                Messages from {contactName} will be translated to this language
              </p>
            </div>
          )}

          {/* Send Language */}
          <div className="space-y-2 pt-2 border-t border-border/50">
            <Label htmlFor="contact-send-language" className="text-sm font-medium">
              Send messages in
            </Label>
            <Select
              value={preferences.send_language}
              onValueChange={(value) => updatePreferences({ send_language: value })}
              disabled={saving}
            >
              <SelectTrigger id="contact-send-language" className="w-full bg-background">
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
              Your default language when messaging {contactName}
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
