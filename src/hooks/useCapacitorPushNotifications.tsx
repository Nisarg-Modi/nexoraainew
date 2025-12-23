import { useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, PushNotificationSchema, Token, ActionPerformed } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const useCapacitorPushNotifications = () => {
  const { user } = useAuth();
  const registeredRef = useRef(false);

  const registerPushNotifications = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      console.log('Not a native platform, skipping Capacitor push notifications');
      return;
    }

    if (registeredRef.current) {
      console.log('Already registered for push notifications');
      return;
    }

    try {
      // Request permission
      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.log('Push notification permission not granted');
        return;
      }

      // Register with platform
      await PushNotifications.register();
      registeredRef.current = true;
      console.log('Push notifications registered');
    } catch (error) {
      console.error('Error registering push notifications:', error);
    }
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !user?.id) return;

    // Handle registration success
    const tokenListener = PushNotifications.addListener(
      'registration',
      async (token: Token) => {
        console.log('Push registration success, token:', token.value);

        // Save token to server
        try {
          await supabase.functions.invoke('save-push-subscription', {
            body: {
              subscription: {
                endpoint: `capacitor://${Capacitor.getPlatform()}/${token.value}`,
                keys: { fcm: token.value },
              },
              userId: user.id,
              platform: Capacitor.getPlatform(),
            },
          });
          console.log('Push token saved to server');
        } catch (error) {
          console.error('Error saving push token:', error);
        }
      }
    );

    // Handle registration error
    const errorListener = PushNotifications.addListener('registrationError', (error) => {
      console.error('Push registration error:', error.error);
    });

    // Handle incoming push notification
    const pushReceivedListener = PushNotifications.addListener(
      'pushNotificationReceived',
      (notification: PushNotificationSchema) => {
        console.log('Push notification received:', notification);
        
        // The GlobalIncomingCallListener will handle showing the call dialog
        // This is just for when the app is in foreground
      }
    );

    // Handle notification action (user tapped on notification)
    const pushActionListener = PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (notification: ActionPerformed) => {
        console.log('Push notification action performed:', notification);

        const data = notification.notification.data;
        
        if (data?.callId) {
          // Navigate to the call
          window.location.href = `/?call=${data.callId}&conversation=${data.conversationId}`;
        }
      }
    );

    // Register for push notifications
    registerPushNotifications();

    // Cleanup
    return () => {
      tokenListener.then((l) => l.remove());
      errorListener.then((l) => l.remove());
      pushReceivedListener.then((l) => l.remove());
      pushActionListener.then((l) => l.remove());
    };
  }, [user?.id, registerPushNotifications]);

  return { registerPushNotifications };
};
