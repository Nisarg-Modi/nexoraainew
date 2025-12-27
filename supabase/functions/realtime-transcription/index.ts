import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  // Extract auth token from query parameter
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    console.log("No authentication token provided");
    return new Response(
      JSON.stringify({ error: "Unauthorized: No authentication token provided" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Verify the token using Supabase
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    console.log("Authentication failed:", authError?.message || "No user found");
    return new Response(
      JSON.stringify({ error: "Unauthorized: Invalid or expired token" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log("User authenticated:", user.id);

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { socket, response } = Deno.upgradeWebSocket(req);

    socket.onopen = async () => {
      console.log("Client WebSocket connected");

      // Connect to OpenAI Realtime API.
      // Note: browsers can't send custom headers in WS, so OpenAI supports passing
      // auth via WebSocket subprotocols (safe here since this runs server-side).
      const openAISocket = new WebSocket(
        "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01",
        [
          "realtime",
          `openai-insecure-api-key.${OPENAI_API_KEY}`,
          "openai-beta.realtime-v1",
        ]
      );

      let sessionConfigured = false;

      openAISocket.onopen = () => {
        console.log("OpenAI WebSocket connected");
      };

      openAISocket.onmessage = (event: MessageEvent) => {
        const raw = typeof event.data === "string" ? event.data : "";
        if (!raw) return;

        const data = JSON.parse(raw);
        console.log("OpenAI message type:", data.type);

        // Configure session after connection
        if (data.type === "session.created" && !sessionConfigured) {
          sessionConfigured = true;
          const sessionConfig = {
            type: "session.update",
            session: {
              modalities: ["text", "audio"],
              instructions: "You are a helpful meeting assistant that transcribes audio accurately.",
              voice: "alloy",
              input_audio_format: "pcm16",
              output_audio_format: "pcm16",
              input_audio_transcription: {
                model: "whisper-1",
              },
              turn_detection: {
                type: "server_vad",
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 1000,
              },
              temperature: 0.8,
              max_response_output_tokens: "inf",
            },
          };
          openAISocket.send(JSON.stringify(sessionConfig));
          console.log("Session configured");
        }

        // Forward transcriptions to client
        if (
          data.type === "conversation.item.input_audio_transcription.completed" ||
          data.type === "response.audio_transcript.delta" ||
          data.type === "response.audio_transcript.done"
        ) {
          socket.send(JSON.stringify(data));
        }

        // Forward other relevant events
        if (
          data.type === "response.created" ||
          data.type === "response.done" ||
          data.type === "error"
        ) {
          socket.send(JSON.stringify(data));
        }
      };

      openAISocket.onerror = (event: Event) => {
        console.error("OpenAI WebSocket error:", event);
        socket.send(JSON.stringify({ type: "error", error: "OpenAI connection error" }));
      };

      openAISocket.onclose = () => {
        console.log("OpenAI WebSocket closed");
        socket.close();
      };

      // Handle messages from client (audio data)
      socket.onmessage = (event: MessageEvent) => {
        try {
          const raw = typeof event.data === "string" ? event.data : "";
          if (!raw) return;

          const message = JSON.parse(raw);

          // Forward audio data to OpenAI
          if (message.type === "input_audio_buffer.append") {
            openAISocket.send(JSON.stringify(message));
          }

          // Handle commit requests
          if (message.type === "input_audio_buffer.commit") {
            openAISocket.send(JSON.stringify(message));
          }
        } catch (error) {
          console.error("Error processing client message:", error);
        }
      };

      socket.onclose = () => {
        console.log("Client WebSocket closed");
        openAISocket.close();
      };

      socket.onerror = (error) => {
        console.error("Client WebSocket error:", error);
        openAISocket.close();
      };
    };

    return response;
  } catch (error) {
    console.error("WebSocket setup error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
