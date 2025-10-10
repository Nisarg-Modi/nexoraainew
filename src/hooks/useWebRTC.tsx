import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface WebRTCConfig {
  callId: string;
  userId: string;
  isVideo: boolean;
  onRemoteStream?: (stream: MediaStream) => void;
}

export const useWebRTC = ({ callId, userId, isVideo, onRemoteStream }: WebRTCConfig) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [isConnecting, setIsConnecting] = useState(false);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const channelRef = useRef<any>(null);

  const configuration: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
    ],
    iceCandidatePoolSize: 10,
  };

  const startLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: isVideo,
        audio: true,
      });
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw error;
    }
  };

  const createPeerConnection = (participantId: string, stream: MediaStream) => {
    const pc = new RTCPeerConnection(configuration);

    // Add local tracks
    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('Received remote track from:', participantId);
      const [remoteStream] = event.streams;
      setRemoteStreams(prev => {
        const updated = new Map(prev);
        updated.set(participantId, remoteStream);
        return updated;
      });
      onRemoteStream?.(remoteStream);
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        supabase.channel(`call:${callId}`).send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: {
            candidate: event.candidate,
            from: userId,
            to: participantId,
          },
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
    };

    peerConnections.current.set(participantId, pc);
    return pc;
  };

  const makeOffer = async (participantId: string, stream: MediaStream) => {
    const pc = createPeerConnection(participantId, stream);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await supabase.channel(`call:${callId}`).send({
      type: 'broadcast',
      event: 'offer',
      payload: {
        offer,
        from: userId,
        to: participantId,
      },
    });
  };

  const handleOffer = async (offer: RTCSessionDescriptionInit, from: string, stream: MediaStream) => {
    const pc = createPeerConnection(from, stream);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await supabase.channel(`call:${callId}`).send({
      type: 'broadcast',
      event: 'answer',
      payload: {
        answer,
        from: userId,
        to: from,
      },
    });
  };

  const handleAnswer = async (answer: RTCSessionDescriptionInit, from: string) => {
    const pc = peerConnections.current.get(from);
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  };

  const handleIceCandidate = async (candidate: RTCIceCandidateInit, from: string) => {
    const pc = peerConnections.current.get(from);
    if (pc) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  };

  const initializeCall = async (participantIds: string[]) => {
    setIsConnecting(true);
    try {
      const stream = await startLocalStream();
      
      // Subscribe to signaling channel
      const channel = supabase.channel(`call:${callId}`);
      channelRef.current = channel;

      await channel
        .on('broadcast', { event: 'offer' }, async ({ payload }) => {
          if (payload.to === userId) {
            console.log('Received offer from:', payload.from);
            await handleOffer(payload.offer, payload.from, stream);
          }
        })
        .on('broadcast', { event: 'answer' }, async ({ payload }) => {
          if (payload.to === userId) {
            console.log('Received answer from:', payload.from);
            await handleAnswer(payload.answer, payload.from);
          }
        })
        .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
          if (payload.to === userId) {
            console.log('Received ICE candidate from:', payload.from);
            await handleIceCandidate(payload.candidate, payload.from);
          }
        })
        .subscribe();

      // Create offers to all participants
      for (const participantId of participantIds) {
        if (participantId !== userId) {
          await makeOffer(participantId, stream);
        }
      }
    } catch (error) {
      console.error('Error initializing call:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return audioTrack.enabled;
      }
    }
    return false;
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        return videoTrack.enabled;
      }
    }
    return false;
  };

  const endCall = () => {
    // Stop local stream
    localStream?.getTracks().forEach(track => track.stop());
    setLocalStream(null);

    // Close all peer connections
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();

    // Clear remote streams
    setRemoteStreams(new Map());

    // Unsubscribe from channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      endCall();
    };
  }, []);

  return {
    localStream,
    remoteStreams,
    isConnecting,
    initializeCall,
    toggleAudio,
    toggleVideo,
    endCall,
  };
};
