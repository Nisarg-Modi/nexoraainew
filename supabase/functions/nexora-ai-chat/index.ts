import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatMessage {
  role: string;
  content: string;
}

// In-memory rate limit store (per edge function instance)
// For production, consider using Redis or database-based rate limiting
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Rate limit configuration: 20 requests per minute per user
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

function checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const userLimit = rateLimitStore.get(userId);

  // Clean up expired entries periodically
  if (rateLimitStore.size > 1000) {
    for (const [key, value] of rateLimitStore.entries()) {
      if (now > value.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }

  if (!userLimit || now > userLimit.resetTime) {
    // First request or window expired - reset
    rateLimitStore.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetIn: RATE_LIMIT_WINDOW_MS };
  }

  if (userLimit.count >= RATE_LIMIT_MAX) {
    // Rate limit exceeded
    return { allowed: false, remaining: 0, resetIn: userLimit.resetTime - now };
  }

  // Increment count
  userLimit.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - userLimit.count, resetIn: userLimit.resetTime - now };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract user from JWT for rate limiting
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("Missing authorization header");
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client to verify user
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError?.message);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check rate limit
    const rateLimit = checkRateLimit(user.id);
    if (!rateLimit.allowed) {
      console.warn("Rate limit exceeded for user:", user.id);
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded. Please wait before sending more messages.',
          retryAfter: Math.ceil(rateLimit.resetIn / 1000)
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(rateLimit.resetIn / 1000))
          } 
        }
      );
    }

    console.log("Rate limit check passed for user:", user.id, "Remaining:", rateLimit.remaining);

    const body = await req.json();
    const { messages } = body;
    
    // Validate messages array exists and is an array
    if (!messages || !Array.isArray(messages)) {
      console.error("Invalid request: messages must be an array");
      return new Response(
        JSON.stringify({ error: 'Invalid request: messages must be an array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate message count (1-50 messages allowed)
    if (messages.length === 0 || messages.length > 50) {
      console.error("Invalid message count:", messages.length);
      return new Response(
        JSON.stringify({ error: 'Message count must be between 1 and 50' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate each message structure
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i] as ChatMessage;
      
      if (!msg || typeof msg !== 'object') {
        console.error("Invalid message format at index", i);
        return new Response(
          JSON.stringify({ error: 'Invalid message format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!msg.role || !msg.content) {
        console.error("Message missing role or content at index", i);
        return new Response(
          JSON.stringify({ error: 'Each message must have role and content' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Only allow user and assistant roles from client
      if (!['user', 'assistant'].includes(msg.role)) {
        console.error("Invalid message role at index", i, ":", msg.role);
        return new Response(
          JSON.stringify({ error: 'Invalid message role. Only user and assistant allowed.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate content is a string and not too long (max 10,000 chars per message)
      if (typeof msg.content !== 'string') {
        console.error("Message content is not a string at index", i);
        return new Response(
          JSON.stringify({ error: 'Message content must be a string' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (msg.content.length > 10000) {
        console.error("Message content too long at index", i, ":", msg.content.length);
        return new Response(
          JSON.stringify({ error: 'Message content too long (max 10,000 characters)' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Processing Nexora AI chat request with", messages.length, "validated messages");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { 
            role: "system", 
            content: `You are Nexora AI, a helpful and friendly AI assistant integrated into a messaging app. You help users with:
- Answering questions on any topic
- Providing suggestions and recommendations
- Helping with tasks and problem-solving
- Having casual conversations
- Providing quick information and facts

Keep your responses concise, helpful, and conversational. Use emojis sparingly to add warmth. If you don't know something, be honest about it.` 
          },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds to your workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Streaming response from AI gateway");

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Nexora AI chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
