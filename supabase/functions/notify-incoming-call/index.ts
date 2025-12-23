import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { callId, recipientUserId, callerName, callType } = await req.json();

    if (!callId || !recipientUserId) {
      throw new Error("callId and recipientUserId are required");
    }

    console.log(`Sending call notification for call ${callId} to user ${recipientUserId}`);

    // Send push notification
    const { data, error } = await supabase.functions.invoke("send-push-notification", {
      body: {
        userId: recipientUserId,
        title: `Incoming ${callType === 'video' ? 'Video' : 'Voice'} Call`,
        body: `${callerName || 'Someone'} is calling you`,
        data: {
          type: 'incoming_call',
          callId,
          callerName,
          callType,
        },
      },
    });

    if (error) {
      console.error("Error sending push notification:", error);
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
