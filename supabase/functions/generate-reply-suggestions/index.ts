import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize auth header to ensure it's a valid ByteString (ASCII only)
    const sanitizedAuthHeader = authHeader.replace(/[^\x00-\x7F]/g, '');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: sanitizedAuthHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { conversationContext, currentMessage } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Generating reply suggestions for message:', currentMessage);

    // Generate suggestions for all tones in parallel
    const tones = ['professional', 'casual', 'witty', 'empathetic'];
    const suggestions = await Promise.all(
      tones.map(async (tone) => {
        const systemPrompt = `You are a helpful AI assistant that generates short, natural message replies in a ${tone} tone. 
Generate a single, concise reply (1-2 sentences max) that appropriately responds to the conversation context.
Keep it conversational and natural - like how a real person would text.`;

        const userPrompt = `Recent conversation:
${conversationContext.map((msg: any) => `${msg.sender}: ${msg.text}`).join('\n')}

Generate a ${tone} reply to the last message. Just provide the reply text, nothing else.`;

        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
            temperature: 0.8,
            max_tokens: 100,
          }),
        });

        if (!response.ok) {
          console.error(`AI gateway error for ${tone}:`, response.status);
          return null;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content?.trim();
        
        return {
          tone,
          text: content || `Thanks for your message!`
        };
      })
    );

    // Filter out any failed suggestions
    const validSuggestions = suggestions.filter(s => s !== null);

    console.log('Generated suggestions:', validSuggestions.length);

    return new Response(
      JSON.stringify({ suggestions: validSuggestions }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error generating suggestions:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        suggestions: [] 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
