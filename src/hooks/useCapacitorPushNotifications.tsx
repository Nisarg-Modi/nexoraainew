import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// Dynamically import Capacitor modules only when needed
const getCapacitor = async () => {
  try {
    const { Capacitor } = await import('@capacitor/core');
    return Capacitor;
  } catch {
    return null;
  }
};

const getPushNotifications = async () => {
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    return PushNotifications;
  } catch {
    return null;
  }
};

export const useCapacitorPushNotifications = () => {
  const { user } = useAuth();
  const registeredRef = useRef(false);
  const listenersRef = useRef<Array<{ remove: () => void }>>([]);

  const registerPushNotifications = useCallback(async () => {
    const Capacitor = await getCapacitor();
    const PushNotifications = await getPushNotifications();

    if (!Capacitor || !PushNotifications) {
      console.log('Capacitor not available, skipping push notifications');
      return;
    }

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
    if (!user?.id) return;

    let isMounted = true;

    const setupListeners = async () => {
      const Capacitor = await getCapacitor();
      const PushNotifications = await getPushNotifications();

      if (!Capacitor || !PushNotifications || !Capacitor.isNativePlatform()) {
        return;
      }

      if (!isMounted) return;

      try {
        // Handle registration success
        const tokenListener = await PushNotifications.addListener(
          'registration',
          async (token: { value: string }) => {
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
        listenersRef.current.push(tokenListener);

        // Handle registration error
        const errorListener = await PushNotifications.addListener(
          'registrationError',
          (error: { error: string }) => {
            console.error('Push registration error:', error.error);
          }
        );
        listenersRef.current.push(errorListener);

        // Handle incoming push notification
        const pushReceivedListener = await PushNotifications.addListener(
          'pushNotificationReceived',
          (notification: unknown) => {
            console.log('Push notification received:', notification);
          }
        );
        listenersRef.current.push(pushReceivedListener);

        // Handle notification action (user tapped on notification)
        const pushActionListener = await PushNotifications.addListener(
          'pushNotificationActionPerformed',
          (notification: { notification: { data?: { callId?: string; conversationId?: string } } }) => {
            console.log('Push notification action performed:', notification);

            const data = notification.notification.data;
            
            if (data?.callId) {
              // Navigate to the call
              window.location.href = `/?call=${data.callId}&conversation=${data.conversationId}`;
            }
          }
        );
        listenersRef.current.push(pushActionListener);

        // Register for push notifications
        registerPushNotifications();
      } catch (error) {
        console.error('Error setting up push notification listeners:', error);
      }
    };

    setupListeners();

    // Cleanup
    return () => {
      isMounted = false;
      listenersRef.current.forEach((listener) => {
        try {
          listener.remove();
        } catch (e) {
          console.error('Error removing listener:', e);
        }
      });
      listenersRef.current = [];
    };
  }, [user?.id, registerPushNotifications]);

  return { registerPushNotifications };
};
