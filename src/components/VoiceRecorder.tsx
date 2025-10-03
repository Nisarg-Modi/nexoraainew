import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface VoiceRecorderProps {
  onRecordingComplete: (transcription: string) => void;
  disabled?: boolean;
}

// Extend Window interface for webkit
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onRecordingComplete, disabled }) => {
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>('');
  const { toast } = useToast();

  const startRecording = async () => {
    try {
      // Check for browser support
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        toast({
          title: "Not supported",
          description: "Speech recognition is not supported in this browser. Please use Chrome or Edge.",
          variant: "destructive",
        });
        return;
      }

      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      transcriptRef.current = '';

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsRecording(true);
        toast({
          title: "Listening...",
          description: "Start speaking now",
        });
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          }
        }

        if (finalTranscript) {
          transcriptRef.current += finalTranscript;
          console.log('Captured:', finalTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
        
        if (event.error === 'no-speech') {
          toast({
            title: "No speech detected",
            description: "Please speak clearly and try again",
            variant: "destructive",
          });
        } else if (event.error !== 'aborted') {
          toast({
            title: "Error",
            description: `Speech recognition error: ${event.error}`,
            variant: "destructive",
          });
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
        
        const finalText = transcriptRef.current.trim();
        console.log('Final transcript:', finalText);
        
        if (finalText) {
          onRecordingComplete(finalText);
        }
        
        transcriptRef.current = '';
      };

      recognition.start();
    } catch (error) {
      console.error('Error starting recording:', error);
      setIsRecording(false);
      toast({
        title: "Error",
        description: "Could not start recording",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      const finalText = transcriptRef.current.trim();
      
      if (!finalText) {
        toast({
          title: "No speech detected",
          description: "Please speak before stopping the recording",
          variant: "destructive",
        });
      }
      
      recognitionRef.current.stop();
    }
  };

  return (
    <Button
      type="button"
      variant={isRecording ? "destructive" : "outline"}
      size="icon"
      onClick={isRecording ? stopRecording : startRecording}
      disabled={disabled}
    >
      {isRecording ? (
        <Square className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </Button>
  );
};

export default VoiceRecorder;
