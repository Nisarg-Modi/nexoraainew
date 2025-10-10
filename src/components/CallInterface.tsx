import { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useWebRTC } from '@/hooks/useWebRTC';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CallInterfaceProps {
  callId: string;
  userId: string;
  participantIds: string[];
  participantNames: Map<string, string>;
  isVideo: boolean;
  onEndCall: () => void;
}

export const CallInterface = ({
  callId,
  userId,
  participantIds,
  participantNames,
  isVideo,
  onEndCall,
}: CallInterfaceProps) => {
  const { toast } = useToast();
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideosRef = useRef<Map<string, HTMLVideoElement>>(new Map());

  const {
    localStream,
    remoteStreams,
    isConnecting,
    initializeCall,
    toggleAudio,
    toggleVideo,
    endCall,
  } = useWebRTC({
    callId,
    userId,
    isVideo,
    onRemoteStream: (stream) => {
      console.log('New remote stream received');
    },
  });

  useEffect(() => {
    initializeCall(participantIds);
  }, []);

  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(e => console.error('Error playing local video:', e));
    }
  }, [localStream]);

  const handleToggleMute = () => {
    const newState = toggleAudio();
    setIsMuted(!newState);
    toast({
      description: newState ? 'Microphone on' : 'Microphone off',
    });
  };

  const handleToggleVideo = () => {
    const newState = toggleVideo();
    setIsVideoOff(!newState);
    toast({
      description: newState ? 'Camera on' : 'Camera off',
    });
  };

  const handleEndCall = async () => {
    endCall();
    
    // Update call status
    await supabase
      .from('calls')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('id', callId);

    // Update participant status
    await supabase
      .from('call_participants')
      .update({ status: 'left', left_at: new Date().toISOString() })
      .eq('call_id', callId)
      .eq('user_id', userId);

    onEndCall();
  };

  if (isConnecting) {
    return (
      <Card className="fixed inset-4 z-50 flex items-center justify-center bg-background/95 backdrop-blur">
        <div className="text-center space-y-4">
          <Phone className="w-16 h-16 animate-pulse mx-auto text-primary" />
          <p className="text-lg">Connecting...</p>
        </div>
      </Card>
    );
  }

  // Get the first remote participant for main view
  const mainParticipant = Array.from(remoteStreams.entries())[0];
  const [mainVideoRef, setMainVideoRef] = useState<HTMLVideoElement | null>(null);

  // Set up main video when participant or stream changes
  useEffect(() => {
    if (mainVideoRef && mainParticipant?.[1]) {
      mainVideoRef.srcObject = mainParticipant[1];
      mainVideoRef.play().catch(e => console.error('Error playing main video:', e));
    }
  }, [mainVideoRef, mainParticipant]);

  return (
    <Card className="fixed inset-4 z-50 flex flex-col bg-background/95 backdrop-blur">
      {/* Main Video Area */}
      <div className="flex-1 p-4 flex items-center justify-center">
        {mainParticipant ? (
          <div className="relative w-full h-full rounded-lg overflow-hidden bg-muted">
            {isVideo ? (
              <video
                ref={setMainVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-32 h-32 rounded-full bg-primary/20 flex items-center justify-center">
                  <Users className="w-16 h-16 text-primary" />
                </div>
              </div>
            )}
            <div className="absolute bottom-4 left-4 bg-background/80 px-3 py-2 rounded text-base">
              {participantNames.get(mainParticipant[0]) || 'Participant'}
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center space-y-4">
              <Phone className="w-16 h-16 animate-pulse mx-auto text-muted-foreground" />
              <p className="text-lg text-muted-foreground">Waiting for others to join...</p>
            </div>
          </div>
        )}
      </div>

      {/* Thumbnail Strip */}
      <div className="px-4 pb-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {/* Local Video Thumbnail */}
          <div className="relative flex-shrink-0 w-32 h-24 rounded-lg overflow-hidden bg-muted border-2 border-primary">
            {isVideo ? (
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary" />
                </div>
              </div>
            )}
            <div className="absolute bottom-1 left-1 bg-background/80 px-2 py-0.5 rounded text-xs">
              You
            </div>
          </div>

          {/* Other Remote Video Thumbnails */}
          {Array.from(remoteStreams.entries()).slice(1).map(([participantId, stream]) => {
            const ThumbnailVideo = () => {
              const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
              
              useEffect(() => {
                if (videoEl && stream) {
                  videoEl.srcObject = stream;
                  videoEl.play().catch(e => console.error('Error playing thumbnail video:', e));
                  remoteVideosRef.current.set(participantId, videoEl);
                }
              }, [videoEl, stream]);

              return (
                <video
                  ref={setVideoEl}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              );
            };

            return (
              <div key={participantId} className="relative flex-shrink-0 w-32 h-24 rounded-lg overflow-hidden bg-muted">
                {isVideo ? (
                  <ThumbnailVideo />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                      <Users className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                )}
                <div className="absolute bottom-1 left-1 bg-background/80 px-2 py-0.5 rounded text-xs">
                  {participantNames.get(participantId) || 'Unknown'}
                </div>
              </div>
            );
          })}

          {/* Empty slots for participants not yet connected */}
          {participantIds.length - remoteStreams.size - 1 > 0 &&
            Array.from({ length: participantIds.length - remoteStreams.size - 1 }).map((_, i) => (
              <div key={`empty-${i}`} className="flex-shrink-0 w-32 h-24 rounded-lg bg-muted flex items-center justify-center">
                <Phone className="w-6 h-6 animate-pulse text-muted-foreground" />
              </div>
            ))}
        </div>
      </div>

      {/* Controls */}
      <div className="p-6 bg-background border-t">
        <div className="flex items-center justify-center gap-4">
          <Button
            size="lg"
            variant={isMuted ? 'destructive' : 'secondary'}
            onClick={handleToggleMute}
            className="rounded-full w-14 h-14"
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </Button>

          {isVideo && (
            <Button
              size="lg"
              variant={isVideoOff ? 'destructive' : 'secondary'}
              onClick={handleToggleVideo}
              className="rounded-full w-14 h-14"
            >
              {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
            </Button>
          )}

          <Button
            size="lg"
            variant="destructive"
            onClick={handleEndCall}
            className="rounded-full w-14 h-14"
          >
            <PhoneOff className="w-6 h-6" />
          </Button>
        </div>

        <div className="text-center mt-4">
          <p className="text-sm text-muted-foreground">
            {participantIds.length} participant{participantIds.length > 1 ? 's' : ''}
          </p>
        </div>
      </div>
    </Card>
  );
};
