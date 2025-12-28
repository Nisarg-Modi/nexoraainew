import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DNDSettings {
  dnd_enabled: boolean;
  dnd_start_time: string;
  dnd_end_time: string;
}

export const useDoNotDisturb = () => {
  const [settings, setSettings] = useState<DNDSettings>({
    dnd_enabled: false,
    dnd_start_time: "22:00:00",
    dnd_end_time: "07:00:00",
  });
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data } = await supabase
        .from('profiles')
        .select('dnd_enabled, dnd_start_time, dnd_end_time')
        .eq('user_id', userData.user.id)
        .single();

      if (data) {
        setSettings({
          dnd_enabled: data.dnd_enabled ?? false,
          dnd_start_time: data.dnd_start_time ?? "22:00:00",
          dnd_end_time: data.dnd_end_time ?? "07:00:00",
        });
      }
    } catch (error) {
      console.error('Error fetching DND settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const isInDNDPeriod = useCallback((): boolean => {
    if (!settings.dnd_enabled) return false;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = settings.dnd_start_time.split(':').map(Number);
    const [endHour, endMin] = settings.dnd_end_time.split(':').map(Number);

    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    // Handle overnight periods (e.g., 22:00 to 07:00)
    if (startTime > endTime) {
      // DND is active if current time is after start OR before end
      return currentTime >= startTime || currentTime < endTime;
    } else {
      // Normal period (e.g., 09:00 to 17:00)
      return currentTime >= startTime && currentTime < endTime;
    }
  }, [settings]);

  const shouldPlaySound = useCallback((): boolean => {
    return !isInDNDPeriod();
  }, [isInDNDPeriod]);

  return {
    settings,
    loading,
    isInDNDPeriod,
    shouldPlaySound,
    refetch: fetchSettings,
  };
};
