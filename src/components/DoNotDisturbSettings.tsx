import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Moon, Loader2, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface DNDSettings {
  dnd_enabled: boolean;
  dnd_start_time: string;
  dnd_end_time: string;
}

export const DoNotDisturbSettings = () => {
  const [settings, setSettings] = useState<DNDSettings>({
    dnd_enabled: false,
    dnd_start_time: "22:00",
    dnd_end_time: "07:00",
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
        .select('dnd_enabled, dnd_start_time, dnd_end_time')
        .eq('user_id', userData.user.id)
        .single();

      if (error) throw error;

      if (data) {
        setSettings({
          dnd_enabled: data.dnd_enabled ?? false,
          dnd_start_time: data.dnd_start_time?.slice(0, 5) ?? "22:00",
          dnd_end_time: data.dnd_end_time?.slice(0, 5) ?? "07:00",
        });
      }
    } catch (error) {
      console.error('Error fetching DND settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (updates: Partial<DNDSettings>) => {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const newSettings = { ...settings, ...updates };
      
      const { error } = await supabase
        .from('profiles')
        .update({
          dnd_enabled: newSettings.dnd_enabled,
          dnd_start_time: newSettings.dnd_start_time + ':00',
          dnd_end_time: newSettings.dnd_end_time + ':00',
        })
        .eq('user_id', userData.user.id);

      if (error) throw error;

      setSettings(newSettings);

      if ('dnd_enabled' in updates) {
        toast({
          title: updates.dnd_enabled ? "Do Not Disturb enabled" : "Do Not Disturb disabled",
          description: updates.dnd_enabled 
            ? `Silent mode active from ${newSettings.dnd_start_time} to ${newSettings.dnd_end_time}`
            : "You'll receive notification sounds",
        });
      } else {
        toast({
          title: "Schedule updated",
          description: `Do Not Disturb: ${newSettings.dnd_start_time} - ${newSettings.dnd_end_time}`,
        });
      }
    } catch (error) {
      console.error('Error updating DND settings:', error);
      toast({
        title: "Error",
        description: "Failed to update settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (enabled: boolean) => {
    updateSettings({ dnd_enabled: enabled });
  };

  const handleTimeChange = (field: 'dnd_start_time' | 'dnd_end_time', value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleTimeBlur = (field: 'dnd_start_time' | 'dnd_end_time') => {
    updateSettings({ [field]: settings[field] });
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
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Moon className={settings.dnd_enabled ? "w-5 h-5 text-primary" : "w-5 h-5 text-muted-foreground"} />
        Do Not Disturb
      </h3>
      
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="dnd-toggle" className="text-base">
            Enable scheduled quiet hours
          </Label>
          <p className="text-sm text-muted-foreground">
            Automatically silence notifications during set times
          </p>
        </div>
        <Switch
          id="dnd-toggle"
          checked={settings.dnd_enabled}
          onCheckedChange={handleToggle}
          disabled={saving}
        />
      </div>

      {settings.dnd_enabled && (
        <div className="pt-3 border-t border-border/50 space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>Schedule</span>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-time" className="text-sm">
                Start time
              </Label>
              <Input
                id="start-time"
                type="time"
                value={settings.dnd_start_time}
                onChange={(e) => handleTimeChange('dnd_start_time', e.target.value)}
                onBlur={() => handleTimeBlur('dnd_start_time')}
                disabled={saving}
                className="bg-background"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="end-time" className="text-sm">
                End time
              </Label>
              <Input
                id="end-time"
                type="time"
                value={settings.dnd_end_time}
                onChange={(e) => handleTimeChange('dnd_end_time', e.target.value)}
                onBlur={() => handleTimeBlur('dnd_end_time')}
                disabled={saving}
                className="bg-background"
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Notifications will be silenced from {settings.dnd_start_time} to {settings.dnd_end_time} daily
          </p>
        </div>
      )}
    </div>
  );
};
