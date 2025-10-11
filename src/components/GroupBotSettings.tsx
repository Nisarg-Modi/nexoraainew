import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Bot, Settings, Sparkles } from 'lucide-react';

interface GroupBotSettingsProps {
  conversationId: string;
  isAdmin: boolean;
}

export const GroupBotSettings = ({ conversationId, isAdmin }: GroupBotSettingsProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    enabled: true,
    default_mode: 'assistant',
    persona: 'professional',
    auto_translate: false,
    target_language: 'en',
    moderation_enabled: false,
  });

  useEffect(() => {
    loadSettings();
  }, [conversationId]);

  const loadSettings = async () => {
    const { data, error } = await supabase
      .from('bot_settings')
      .select('*')
      .eq('conversation_id', conversationId)
      .single();

    if (data) {
      setSettings(data);
    } else if (error && error.code !== 'PGRST116') {
      console.error('Error loading bot settings:', error);
    }
  };

  const saveSettings = async () => {
    if (!isAdmin) {
      toast({
        title: 'Permission denied',
        description: 'Only group admins can change bot settings',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('bot_settings')
        .upsert({
          conversation_id: conversationId,
          ...settings,
        });

      if (error) throw error;

      toast({
        title: 'Settings saved',
        description: 'GroupBotAI settings updated successfully',
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Bot className="w-6 h-6 text-primary" />
        <div>
          <h3 className="text-lg font-semibold">GroupBotAI Settings</h3>
          <p className="text-sm text-muted-foreground">
            Configure your AI assistant for this group
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Enable Bot</Label>
            <p className="text-sm text-muted-foreground">
              Allow GroupBotAI to participate in conversations
            </p>
          </div>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(enabled) => setSettings({ ...settings, enabled })}
            disabled={!isAdmin}
          />
        </div>

        <div className="space-y-2">
          <Label>Default Mode</Label>
          <Select
            value={settings.default_mode}
            onValueChange={(default_mode) => setSettings({ ...settings, default_mode })}
            disabled={!isAdmin}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="assistant">Assistant - Tasks & Reminders</SelectItem>
              <SelectItem value="knowledge">Knowledge - Q&A</SelectItem>
              <SelectItem value="moderator">Moderator - Content Moderation</SelectItem>
              <SelectItem value="persona">Persona - Custom Personality</SelectItem>
              <SelectItem value="translation">Translation - Auto Translate</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Persona</Label>
          <Select
            value={settings.persona}
            onValueChange={(persona) => setSettings({ ...settings, persona })}
            disabled={!isAdmin}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="professional">Professional</SelectItem>
              <SelectItem value="funny">Funny</SelectItem>
              <SelectItem value="tutor">Tutor</SelectItem>
              <SelectItem value="motivator">Motivator</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Auto Translation</Label>
            <p className="text-sm text-muted-foreground">
              Automatically translate messages
            </p>
          </div>
          <Switch
            checked={settings.auto_translate}
            onCheckedChange={(auto_translate) => setSettings({ ...settings, auto_translate })}
            disabled={!isAdmin}
          />
        </div>

        {settings.auto_translate && (
          <div className="space-y-2">
            <Label>Target Language</Label>
            <Select
              value={settings.target_language}
              onValueChange={(target_language) => setSettings({ ...settings, target_language })}
              disabled={!isAdmin}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Spanish</SelectItem>
                <SelectItem value="fr">French</SelectItem>
                <SelectItem value="de">German</SelectItem>
                <SelectItem value="ja">Japanese</SelectItem>
                <SelectItem value="zh">Chinese</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Content Moderation</Label>
            <p className="text-sm text-muted-foreground">
              Suggest polite rewrites for problematic messages
            </p>
          </div>
          <Switch
            checked={settings.moderation_enabled}
            onCheckedChange={(moderation_enabled) => setSettings({ ...settings, moderation_enabled })}
            disabled={!isAdmin}
          />
        </div>
      </div>

      <Button
        onClick={saveSettings}
        disabled={loading || !isAdmin}
        className="w-full"
      >
        <Settings className="w-4 h-4 mr-2" />
        {loading ? 'Saving...' : 'Save Settings'}
      </Button>

      {!isAdmin && (
        <p className="text-sm text-muted-foreground text-center">
          Only group admins can modify these settings
        </p>
      )}
    </Card>
  );
};
