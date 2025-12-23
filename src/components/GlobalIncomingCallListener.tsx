import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { IncomingCallDialog } from './IncomingCallDialog';
import { useToast } from '@/hooks/use-toast';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface IncomingCall {
  id: string;
  callerName: string;
  callType: 'audio' | 'video';
  conversationId: string;
}

export const GlobalIncomingCallListener = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { showLocalNotification, requestPermission, isPermissionGranted } = usePushNotifications();
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);

  // Request notification permission on mount
  useEffect(() => {
    if (!isPermissionGranted) {
      requestPermission();
    }
  }, [isPermissionGranted, requestPermission]);

  // Listen for incoming calls via Supabase Realtime
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('global-incoming-calls')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_participants',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          console.log('New call participant entry:', payload);

          const participantRecord = payload.new as {
            id: string;
            call_id: string;
            user_id: string;
            status: string;
          };

          // Only handle pending calls (not ones we initiated)
          if (participantRecord.status !== 'pending') return;

          // Fetch call details
          const { data: callData, error: callError } = await supabase
            .from('calls')
            .select('*, profiles:caller_id(display_name)')
            .eq('id', participantRecord.call_id)
            .single();

          if (callError || !callData) {
            console.error('Error fetching call:', callError);
            return;
          }

          // Don't show notification if we're the caller
          if (callData.caller_id === user.id) return;

          // Get caller's display name
          const { data: callerProfile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('user_id', callData.caller_id)
            .single();

          const callerName = callerProfile?.display_name || 'Unknown';
          const callType = callData.call_type as 'audio' | 'video';

          // Set incoming call state
          setIncomingCall({
            id: callData.id,
            callerName,
            callType,
            conversationId: callData.conversation_id,
          });

          // Show notification (for when app is in background but tab is open)
          showLocalNotification(
            `Incoming ${callType === 'video' ? 'Video' : 'Voice'} Call`,
            {
              body: `${callerName} is calling you`,
              icon: '/favicon.ico',
              tag: `call-${callData.id}`,
              requireInteraction: true,
            }
          );

          // Play ringtone
          playRingtone();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, showLocalNotification]);

  // Listen for call status changes (answered, rejected, ended)
  useEffect(() => {
    if (!incomingCall) return;

    const channel = supabase
      .channel(`call-status-${incomingCall.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'calls',
          filter: `id=eq.${incomingCall.id}`,
        },
        (payload) => {
          const updatedCall = payload.new as { status: string };
          if (updatedCall.status === 'ended' || updatedCall.status === 'missed') {
            setIncomingCall(null);
            stopRingtone();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [incomingCall?.id]);

  const playRingtone = useCallback(() => {
    // Create and play ringtone audio
    const audio = new Audio('/ringtone.mp3');
    audio.loop = true;
    audio.id = 'ringtone-audio';
    audio.play().catch(console.error);
    document.body.appendChild(audio);
  }, []);

  const stopRingtone = useCallback(() => {
    const audio = document.getElementById('ringtone-audio') as HTMLAudioElement;
    if (audio) {
      audio.pause();
      audio.remove();
    }
  }, []);

  const handleAccept = async () => {
    if (!incomingCall || !user?.id) return;

    try {
      stopRingtone();

      // Update participant status
      await supabase
        .from('call_participants')
        .update({ status: 'joined', joined_at: new Date().toISOString() })
        .eq('call_id', incomingCall.id)
        .eq('user_id', user.id);

      // Update call status
      await supabase
        .from('calls')
        .update({ status: 'active' })
        .eq('id', incomingCall.id);

      // Navigate to call or open call interface
      setActiveCallId(incomingCall.id);
      setIncomingCall(null);

      // Navigate to the chat with the active call
      window.location.href = `/?call=${incomingCall.id}&conversation=${incomingCall.conversationId}`;
    } catch (error) {
      console.error('Error accepting call:', error);
      toast({
        title: 'Error',
        description: 'Failed to accept call',
        variant: 'destructive',
      });
    }
  };

  const handleReject = async () => {
    if (!incomingCall || !user?.id) return;

    try {
      stopRingtone();

      await supabase
        .from('call_participants')
        .update({ status: 'rejected' })
        .eq('call_id', incomingCall.id)
        .eq('user_id', user.id);

      setIncomingCall(null);

      toast({
        title: 'Call Rejected',
        description: 'You rejected the incoming call',
      });
    } catch (error) {
      console.error('Error rejecting call:', error);
    }
  };

  if (!incomingCall) return null;

  return (
    <IncomingCallDialog
      open={!!incomingCall}
      callerName={incomingCall.callerName}
      isVideo={incomingCall.callType === 'video'}
      onAccept={handleAccept}
      onReject={handleReject}
    />
  );
};
