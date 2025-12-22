import "https://deno.land/x/xhr@0.1.0/mod.ts";
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

    // Normalize + sanitize auth header to ensure it's a valid ByteString
    // (prevents invalid characters like CR/LF or other whitespace)
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const safeToken = token.replace(/[^A-Za-z0-9._-]/g, '');
    const sanitizedAuthHeader = `Bearer ${safeToken}`;

    const supabaseUrl = (Deno.env.get('SUPABASE_URL') ?? '').trim();
    const supabaseAnonKey = (Deno.env.get('SUPABASE_ANON_KEY') ?? '').replace(/\s+/g, '');

    const userClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      { global: { headers: { Authorization: sanitizedAuthHeader } } }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { messageId, content } = await req.json();

    if (!messageId || !content) {
      throw new Error('Message ID and content are required');
    }

    // Remove whitespace + any non-ASCII characters (e.g. zero-width spaces) that can break
    // Deno's fetch header ByteString validation.
    const OPENAI_API_KEY_RAW = Deno.env.get('OPENAI_API_KEY') ?? '';
    const OPENAI_API_KEY = OPENAI_API_KEY_RAW.replace(/[^\x21-\x7E]/g, ''); // printable ASCII only
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    // Avoid leaking secrets, but log helpful diagnostics
    console.log('OpenAI key diagnostics:', {
      rawLength: OPENAI_API_KEY_RAW.length,
      cleanedLength: OPENAI_API_KEY.length,
      removedChars: OPENAI_API_KEY_RAW.length - OPENAI_API_KEY.length,
      rawHasNonAscii: /[^\x00-\x7F]/.test(OPENAI_API_KEY_RAW),
      rawHasWhitespace: /\s/.test(OPENAI_API_KEY_RAW),
    });

    console.log('Generating embedding for message:', messageId);

    // Generate embedding using OpenAI
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: content,
        dimensions: 768
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error('Failed to generate embedding');
    }

    const data = await response.json();
    const embedding = data.data[0].embedding;

    // Store embedding in database
    const serviceKey = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '').replace(/\s+/g, '');

    const supabaseClient = createClient(
      supabaseUrl,
      serviceKey
    );

    // Get message details
    const { data: message, error: messageError } = await supabaseClient
      .from('messages')
      .select('conversation_id')
      .eq('id', messageId)
      .single();

    if (messageError) {
      throw new Error(`Failed to fetch message: ${messageError.message}`);
    }

    // Store embedding
    const { error: insertError } = await supabaseClient
      .from('message_embeddings')
      .upsert({
        message_id: messageId,
        conversation_id: message.conversation_id,
        embedding,
        content_preview: content.substring(0, 200)
      });

    if (insertError) {
      console.error('Failed to store embedding:', insertError);
      throw new Error(`Failed to store embedding: ${insertError.message}`);
    }

    console.log('Embedding generated and stored successfully');

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in generate-embedding:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
