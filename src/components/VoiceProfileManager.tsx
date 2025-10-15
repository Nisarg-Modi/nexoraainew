import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Mic, Upload, Play, Trash2 } from 'lucide-react';

interface VoiceProfile {
  id: string;
  name: string;
  voiceId: string;
  isCustom: boolean;
}

const DEFAULT_VOICES = [
  { id: '9BWtsMINqrJLrRacOk9x', name: 'Aria - Warm & Clear' },
  { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger - Confident & Deep' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah - Professional & Clear' },
  { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura - Friendly & Natural' },
  { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie - Energetic & Young' },
];

export const VoiceProfileManager = () => {
  const { toast } = useToast();
  const [customVoices, setCustomVoices] = useState<VoiceProfile[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);
  const [voiceName, setVoiceName] = useState('');
  const [voiceDescription, setVoiceDescription] = useState('');
  const [audioFiles, setAudioFiles] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const readers: Promise<string>[] = [];
    for (let i = 0; i < files.length && i < 5; i++) {
      const reader = new FileReader();
      readers.push(
        new Promise((resolve) => {
          reader.onload = (event) => {
            resolve(event.target?.result as string);
          };
          reader.readAsDataURL(files[i]);
        })
      );
    }

    Promise.all(readers).then((results) => {
      setAudioFiles(results);
      toast({
        title: 'Audio files uploaded',
        description: `${results.length} file(s) ready for voice cloning`,
      });
    });
  };

  const handleCreateVoice = async () => {
    if (!voiceName || audioFiles.length === 0) {
      toast({
        title: 'Missing information',
        description: 'Please provide a name and at least one audio sample',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-voice-clone', {
        body: {
          name: voiceName,
          description: voiceDescription,
          audioFiles,
        },
      });

      if (error) throw error;

      const newVoice: VoiceProfile = {
        id: data.voice_id,
        name: voiceName,
        voiceId: data.voice_id,
        isCustom: true,
      };

      setCustomVoices([...customVoices, newVoice]);
      setVoiceName('');
      setVoiceDescription('');
      setAudioFiles([]);

      toast({
        title: 'Voice created!',
        description: 'Your custom voice is ready to use',
      });
    } catch (error) {
      console.error('Error creating voice:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create voice',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const testVoice = async (voiceId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-tts', {
        body: {
          text: 'Hello! This is a test of my voice. How do I sound?',
          voiceId,
        },
      });

      if (error) throw error;

      const audio = new Audio(`data:audio/mpeg;base64,${data.audioContent}`);
      audio.play();

      toast({
        title: 'Playing voice sample',
      });
    } catch (error) {
      console.error('Error testing voice:', error);
      toast({
        title: 'Error',
        description: 'Failed to test voice',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">Voice Profile Manager</h2>
        
        <div className="space-y-4">
          <div>
            <Label>Select Voice</Label>
            <Select value={selectedVoice} onValueChange={setSelectedVoice}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a voice" />
              </SelectTrigger>
              <SelectContent>
                <div className="text-sm font-semibold px-2 py-1.5 text-muted-foreground">
                  Default Voices
                </div>
                {DEFAULT_VOICES.map((voice) => (
                  <SelectItem key={voice.id} value={voice.id}>
                    {voice.name}
                  </SelectItem>
                ))}
                {customVoices.length > 0 && (
                  <>
                    <div className="text-sm font-semibold px-2 py-1.5 text-muted-foreground mt-2">
                      Custom Voices
                    </div>
                    {customVoices.map((voice) => (
                      <SelectItem key={voice.id} value={voice.voiceId}>
                        {voice.name} (Custom)
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedVoice && (
            <Button onClick={() => testVoice(selectedVoice)} variant="outline">
              <Play className="w-4 h-4 mr-2" />
              Test Voice
            </Button>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-xl font-bold mb-4">Create Custom Voice</h3>
        
        <div className="space-y-4">
          <div>
            <Label>Voice Name</Label>
            <Input
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value)}
              placeholder="My Custom Voice"
            />
          </div>

          <div>
            <Label>Description (Optional)</Label>
            <Textarea
              value={voiceDescription}
              onChange={(e) => setVoiceDescription(e.target.value)}
              placeholder="A professional voice for presentations"
            />
          </div>

          <div>
            <Label>Audio Samples (1-5 files, MP3/WAV)</Label>
            <Input
              type="file"
              accept="audio/*"
              multiple
              onChange={handleFileUpload}
              className="cursor-pointer"
            />
            <p className="text-sm text-muted-foreground mt-2">
              Upload 1-5 audio samples (at least 30 seconds each) for best results
            </p>
            {audioFiles.length > 0 && (
              <p className="text-sm text-primary mt-2">
                {audioFiles.length} file(s) uploaded
              </p>
            )}
          </div>

          <Button 
            onClick={handleCreateVoice} 
            disabled={isCreating || !voiceName || audioFiles.length === 0}
            className="w-full"
          >
            <Upload className="w-4 h-4 mr-2" />
            {isCreating ? 'Creating Voice...' : 'Create Voice'}
          </Button>
        </div>
      </Card>

      {customVoices.length > 0 && (
        <Card className="p-6">
          <h3 className="text-xl font-bold mb-4">My Custom Voices</h3>
          <div className="space-y-2">
            {customVoices.map((voice) => (
              <div key={voice.id} className="flex items-center justify-between p-3 border rounded">
                <span className="font-medium">{voice.name}</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => testVoice(voice.voiceId)}
                  >
                    <Play className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
