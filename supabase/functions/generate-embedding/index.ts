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
    const { messageId, content } = await req.json();
    
    if (!messageId || !content) {
      throw new Error('Message ID and content are required');
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
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
