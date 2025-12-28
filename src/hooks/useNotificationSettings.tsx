import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface NotificationSettings {
  globalSoundEnabled: boolean;
  contactSoundSettings: Record<string, boolean>;
}

export const useNotificationSettings = () => {
  const [settings, setSettings] = useState<NotificationSettings>({
    globalSoundEnabled: true,
    contactSoundSettings: {},
  });
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      // Fetch global setting from profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('notification_sound_enabled')
        .eq('user_id', userData.user.id)
        .single();

      // Fetch per-contact settings
      const { data: contactsData } = await supabase
        .from('contacts')
        .select('contact_user_id, notification_sound_enabled')
        .eq('user_id', userData.user.id);

      const contactSettings: Record<string, boolean> = {};
      contactsData?.forEach(contact => {
        contactSettings[contact.contact_user_id] = contact.notification_sound_enabled ?? true;
      });

      setSettings({
        globalSoundEnabled: profileData?.notification_sound_enabled ?? true,
        contactSoundSettings: contactSettings,
      });
    } catch (error) {
      console.error('Error fetching notification settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateGlobalSoundEnabled = async (enabled: boolean) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return false;

      const { error } = await supabase
        .from('profiles')
        .update({ notification_sound_enabled: enabled })
        .eq('user_id', userData.user.id);

      if (error) throw error;

      setSettings(prev => ({
        ...prev,
        globalSoundEnabled: enabled,
      }));
      return true;
    } catch (error) {
      console.error('Error updating global sound setting:', error);
      return false;
    }
  };

  const updateContactSoundEnabled = async (contactUserId: string, enabled: boolean) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return false;

      const { error } = await supabase
        .from('contacts')
        .update({ notification_sound_enabled: enabled })
        .eq('user_id', userData.user.id)
        .eq('contact_user_id', contactUserId);

      if (error) throw error;

      setSettings(prev => ({
        ...prev,
        contactSoundSettings: {
          ...prev.contactSoundSettings,
          [contactUserId]: enabled,
        },
      }));
      return true;
    } catch (error) {
      console.error('Error updating contact sound setting:', error);
      return false;
    }
  };

  const shouldPlaySoundForContact = (contactUserId: string): boolean => {
    // If global sound is disabled, don't play
    if (!settings.globalSoundEnabled) return false;
    
    // Check per-contact setting, default to true if not set
    return settings.contactSoundSettings[contactUserId] ?? true;
  };

  return {
    settings,
    loading,
    updateGlobalSoundEnabled,
    updateContactSoundEnabled,
    shouldPlaySoundForContact,
    refetch: fetchSettings,
  };
};
