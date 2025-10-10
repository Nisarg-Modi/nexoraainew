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

    // Add local tracks to peer connection
    stream.getTracks().forEach(track => {
      console.log(`Adding ${track.kind} track to peer connection for ${participantId}`);
      pc.addTrack(track, stream);
    });

    // Handle incoming remote tracks
    pc.ontrack = (event) => {
      console.log(`Received remote ${event.track.kind} track from:`, participantId);
      
      if (event.streams && event.streams[0]) {
        const remoteStream = event.streams[0];
        console.log('Remote stream tracks:', remoteStream.getTracks().map(t => t.kind));
        
        setRemoteStreams(prev => {
          const updated = new Map(prev);
          updated.set(participantId, remoteStream);
          return updated;
        });
        onRemoteStream?.(remoteStream);
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate to:', participantId);
        channelRef.current?.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: {
            candidate: {
              candidate: event.candidate.candidate,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
              sdpMid: event.candidate.sdpMid,
            },
            from: userId,
            to: participantId,
          },
        });
      }
    };

    // Monitor connection state
    pc.oniceconnectionstatechange = () => {
      console.log(`ICE connection state for ${participantId}:`, pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed') {
        console.error('ICE connection failed, attempting restart');
        pc.restartIce();
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`Connection state for ${participantId}:`, pc.connectionState);
    };

    peerConnections.current.set(participantId, pc);
    return pc;
  };

  const makeOffer = async (participantId: string, stream: MediaStream) => {
    try {
      console.log('Creating offer for:', participantId);
      const pc = createPeerConnection(participantId, stream);
      
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: isVideo,
      });
      
      await pc.setLocalDescription(offer);
      console.log('Sending offer to:', participantId);

      await channelRef.current?.send({
        type: 'broadcast',
        event: 'offer',
        payload: {
          offer: {
            type: offer.type,
            sdp: offer.sdp,
          },
          from: userId,
          to: participantId,
        },
      });
    } catch (error) {
      console.error('Error making offer:', error);
    }
  };

  const handleOffer = async (offer: RTCSessionDescriptionInit, from: string, stream: MediaStream) => {
    try {
      console.log('Handling offer from:', from);
      const pc = createPeerConnection(from, stream);
      
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('Remote description set for:', from);
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log('Sending answer to:', from);

      await channelRef.current?.send({
        type: 'broadcast',
        event: 'answer',
        payload: {
          answer: {
            type: answer.type,
            sdp: answer.sdp,
          },
          from: userId,
          to: from,
        },
      });
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  };

  const handleAnswer = async (answer: RTCSessionDescriptionInit, from: string) => {
    try {
      const pc = peerConnections.current.get(from);
      if (pc) {
        console.log('Setting remote answer from:', from);
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } else {
        console.error('No peer connection found for:', from);
      }
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  };

  const handleIceCandidate = async (candidate: RTCIceCandidateInit, from: string) => {
    try {
      const pc = peerConnections.current.get(from);
      if (pc && pc.remoteDescription) {
        console.log('Adding ICE candidate from:', from);
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        console.warn('Cannot add ICE candidate - no peer connection or remote description for:', from);
      }
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  };

  const initializeCall = async (participantIds: string[]) => {
    setIsConnecting(true);
    try {
      console.log('Initializing call with participants:', participantIds);
      console.log('Requesting media - audio:', true, 'video:', isVideo);
      
      const stream = await startLocalStream();
      console.log('Local stream acquired with tracks:', stream.getTracks().map(t => `${t.kind}: ${t.enabled}`));
      
      // Subscribe to signaling channel FIRST
      const channel = supabase.channel(`call:${callId}`, {
        config: {
          broadcast: { self: false },
        },
      });
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
        .subscribe((status) => {
          console.log('Channel subscription status:', status);
        });

      // Wait a bit for channel to be ready
      await new Promise(resolve => setTimeout(resolve, 500));

      // Create offers to all other participants
      for (const participantId of participantIds) {
        if (participantId !== userId) {
          console.log('Making offer to:', participantId);
          await makeOffer(participantId, stream);
          // Small delay between offers to avoid overwhelming
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } catch (error) {
      console.error('Error initializing call:', error);
      throw error;
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
