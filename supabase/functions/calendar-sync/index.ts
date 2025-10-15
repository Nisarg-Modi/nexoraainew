import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, meetingId, calendarType, accessToken } = await req.json();

    if (action === 'create-event') {
      // Create calendar event
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? ''
      );

      const { data: meeting } = await supabase
        .from('meetings')
        .select('*')
        .eq('id', meetingId)
        .single();

      if (!meeting) {
        throw new Error('Meeting not found');
      }

      if (calendarType === 'google') {
        const event = {
          summary: meeting.title,
          description: meeting.description || '',
          start: {
            dateTime: meeting.scheduled_start,
            timeZone: 'UTC',
          },
          end: {
            dateTime: meeting.scheduled_end,
            timeZone: 'UTC',
          },
          conferenceData: {
            createRequest: {
              requestId: meeting.id,
              conferenceSolutionKey: {
                type: 'hangoutsMeet'
              }
            }
          }
        };

        const response = await fetch(
          'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(event),
          }
        );

        if (!response.ok) {
          const error = await response.text();
          console.error('Google Calendar API error:', error);
          throw new Error('Failed to create calendar event');
        }

        const result = await response.json();
        
        return new Response(
          JSON.stringify({
            success: true,
            eventId: result.id,
            eventLink: result.htmlLink,
            meetLink: result.hangoutLink,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else if (calendarType === 'outlook') {
        const event = {
          subject: meeting.title,
          body: {
            contentType: 'HTML',
            content: meeting.description || '',
          },
          start: {
            dateTime: meeting.scheduled_start,
            timeZone: 'UTC',
          },
          end: {
            dateTime: meeting.scheduled_end,
            timeZone: 'UTC',
          },
          isOnlineMeeting: true,
          onlineMeetingProvider: 'teamsForBusiness',
        };

        const response = await fetch(
          'https://graph.microsoft.com/v1.0/me/events',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(event),
          }
        );

        if (!response.ok) {
          const error = await response.text();
          console.error('Outlook Calendar API error:', error);
          throw new Error('Failed to create calendar event');
        }

        const result = await response.json();
        
        return new Response(
          JSON.stringify({
            success: true,
            eventId: result.id,
            eventLink: result.webLink,
            meetLink: result.onlineMeeting?.joinUrl,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    throw new Error('Invalid action');
  } catch (error) {
    console.error('Error in calendar-sync:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
