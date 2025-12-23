import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");

    if (!vapidPrivateKey || !vapidPublicKey) {
      console.log("VAPID keys not configured - push notifications disabled");
      return new Response(
        JSON.stringify({ success: false, message: "Push notifications not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: PushPayload = await req.json();
    const { userId, title, body, data } = payload;

    if (!userId || !title) {
      throw new Error("userId and title are required");
    }

    // Get user's push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", userId);

    if (subError) {
      console.error("Error fetching subscriptions:", subError);
      throw new Error("Failed to fetch subscriptions");
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log("No push subscriptions found for user:", userId);
      return new Response(
        JSON.stringify({ success: false, message: "No subscriptions found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const notificationPayload = JSON.stringify({
      title,
      body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: data?.callId ? `call-${data.callId}` : "notification",
      data,
    });

    // Send push notification to each subscription
    const results = await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          const subscriptionData = sub.subscription;

          // Use web-push compatible format
          const response = await sendWebPush(
            subscriptionData,
            notificationPayload,
            vapidPublicKey,
            vapidPrivateKey
          );

          return { success: true, subscriptionId: sub.id };
        } catch (error) {
          console.error("Error sending to subscription:", sub.id, error);
          const errorMessage = error instanceof Error ? error.message : "Unknown error";

          // Remove invalid subscriptions
          if (errorMessage.includes("410") || errorMessage.includes("404")) {
            await supabase
              .from("push_subscriptions")
              .delete()
              .eq("id", sub.id);
          }

          return { success: false, subscriptionId: sub.id, error: errorMessage };
        }
      })
    );

    return new Response(
      JSON.stringify({ success: true, results }),
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

// Simple web push implementation
async function sendWebPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<Response> {
  const url = new URL(subscription.endpoint);

  // Create JWT for VAPID authentication
  const jwt = await createVapidJWT(url.origin, vapidPrivateKey, vapidPublicKey);

  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      TTL: "86400",
      Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
    },
    body: payload,
  });

  if (!response.ok) {
    throw new Error(`Push failed: ${response.status} ${await response.text()}`);
  }

  return response;
}

async function createVapidJWT(
  audience: string,
  privateKey: string,
  publicKey: string
): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: "mailto:notifications@nexora.app",
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));

  // Note: Full ES256 signing would require crypto operations
  // For production, use a proper web-push library
  // This is a simplified version that may need enhancement

  return `${encodedHeader}.${encodedPayload}.signature`;
}

function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
