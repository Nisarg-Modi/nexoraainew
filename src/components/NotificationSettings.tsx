import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Volume2, VolumeX, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNotificationSettings } from "@/hooks/useNotificationSettings";

export const NotificationSettings = () => {
  const { settings, loading, updateGlobalSoundEnabled } = useNotificationSettings();
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();

  const handleToggle = async (enabled: boolean) => {
    setUpdating(true);
    const success = await updateGlobalSoundEnabled(enabled);
    setUpdating(false);

    if (success) {
      toast({
        title: enabled ? "Sound enabled" : "Sound disabled",
        description: enabled 
          ? "You'll hear notification sounds for new messages"
          : "Notification sounds are now muted",
      });
    } else {
      toast({
        title: "Error",
        description: "Failed to update notification settings",
        variant: "destructive",
      });
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
      <h3 className="text-lg font-semibold flex items-center gap-2">
        {settings.globalSoundEnabled ? (
          <Volume2 className="w-5 h-5 text-primary" />
        ) : (
          <VolumeX className="w-5 h-5 text-muted-foreground" />
        )}
        Notification Sounds
      </h3>
      
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="global-sound" className="text-base">
            Enable notification sounds
          </Label>
          <p className="text-sm text-muted-foreground">
            Play a sound when you receive new messages
          </p>
        </div>
        <Switch
          id="global-sound"
          checked={settings.globalSoundEnabled}
          onCheckedChange={handleToggle}
          disabled={updating}
        />
      </div>

      {settings.globalSoundEnabled && (
        <p className="text-xs text-muted-foreground mt-2">
          Tip: You can also mute sounds for individual contacts by swiping right on their name
        </p>
      )}
    </div>
  );
};
