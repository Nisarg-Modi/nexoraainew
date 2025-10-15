import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface CalendarSyncProps {
  meetingId: string;
  meetingTitle: string;
  scheduledStart: string;
  scheduledEnd: string;
}

export const CalendarSync = ({ meetingId, meetingTitle, scheduledStart, scheduledEnd }: CalendarSyncProps) => {
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);
  const [googleToken, setGoogleToken] = useState<string | null>(null);

  const handleGoogleAuth = () => {
    const clientId = ''; // Users need to configure this
    const redirectUri = `${window.location.origin}/auth/callback`;
    const scope = 'https://www.googleapis.com/auth/calendar.events';
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=token&` +
      `scope=${encodeURIComponent(scope)}`;
    
    const popup = window.open(authUrl, 'Google Calendar Auth', 'width=600,height=600');
    
    const messageHandler = (event: MessageEvent) => {
      if (event.origin === window.location.origin && event.data.type === 'google-auth') {
        setGoogleToken(event.data.token);
        toast({
          title: 'Connected',
          description: 'Google Calendar connected successfully',
        });
        window.removeEventListener('message', messageHandler);
      }
    };
    
    window.addEventListener('message', messageHandler);
  };

  const syncToGoogle = async () => {
    if (!googleToken) {
      toast({
        title: 'Not connected',
        description: 'Please connect your Google Calendar first',
        variant: 'destructive',
      });
      return;
    }

    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('calendar-sync', {
        body: {
          action: 'create-event',
          meetingId,
          calendarType: 'google',
          accessToken: googleToken,
        },
      });

      if (error) throw error;

      toast({
        title: 'Event created',
        description: 'Meeting added to Google Calendar',
      });

      if (data.eventLink) {
        window.open(data.eventLink, '_blank');
      }
    } catch (error) {
      console.error('Error syncing to Google Calendar:', error);
      toast({
        title: 'Sync failed',
        description: error instanceof Error ? error.message : 'Failed to sync with Google Calendar',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Calendar Sync
        </CardTitle>
        <CardDescription>
          Add this meeting to your calendar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Google Calendar</span>
            {googleToken ? (
              <Badge variant="secondary">Connected</Badge>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={handleGoogleAuth}
              >
                Connect
              </Button>
            )}
          </div>
          
          {googleToken && (
            <Button
              className="w-full"
              onClick={syncToGoogle}
              disabled={isSyncing}
            >
              <Calendar className="w-4 h-4 mr-2" />
              {isSyncing ? 'Adding to Calendar...' : 'Add to Google Calendar'}
            </Button>
          )}
        </div>

        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground mb-2">
            Need to configure Google Calendar integration?
          </p>
          <Button
            variant="outline"
            size="sm"
            asChild
          >
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Google Cloud Console
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
