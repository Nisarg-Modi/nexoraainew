import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

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

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: sanitizedAuthHeader } } }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { conversationId, summaryType = 'bullets' } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables');
    }

    // Verify user has access to this conversation
    const { data: participant, error: participantError } = await userClient
      .from('conversation_participants')
      .select('conversation_id')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .single();

    if (participantError || !participant) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role for data access
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch conversation messages
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('content, sender_id, created_at, profiles!messages_sender_id_fkey(display_name, username)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      throw new Error('Failed to fetch conversation messages');
    }

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ summary: 'No messages to summarize' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format conversation for AI
    const conversationText = messages.map(msg => {
      // Handle profiles as it might be an array due to Supabase type inference
      const profile = Array.isArray(msg.profiles) ? msg.profiles[0] : msg.profiles;
      const senderName = profile?.display_name || profile?.username || 'User';
      const timestamp = new Date(msg.created_at).toLocaleString();
      return `[${timestamp}] ${senderName}: ${msg.content}`;
    }).join('\n');

    // Create system prompt based on summary type
    let systemPrompt = '';
    if (summaryType === 'bullets') {
      systemPrompt = `You are a helpful assistant that summarizes conversations into clear bullet points. 
Extract the key topics discussed, important decisions made, and main takeaways.
Format your response as a bulleted list with clear, concise points.`;
    } else if (summaryType === 'tldr') {
      systemPrompt = `You are a helpful assistant that creates TL;DR (Too Long; Didn't Read) summaries.
Provide a brief, 2-3 sentence summary of the entire conversation capturing the essence and main points.`;
    } else if (summaryType === 'action_items') {
      systemPrompt = `You are a helpful assistant that extracts action items from conversations.
Identify specific tasks, to-dos, or follow-ups mentioned in the conversation.
Format as a numbered list of actionable items. If no action items exist, say "No action items identified."`;
    }

    const userPrompt = `Please summarize the following conversation:\n\n${conversationText}`;

    console.log('Generating summary for conversation:', conversationId, 'Type:', summaryType);

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
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      console.error('AI gateway error:', response.status);
      throw new Error('Failed to generate summary');
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content?.trim();

    console.log('Summary generated successfully');

    return new Response(
      JSON.stringify({ 
        summary: summary || 'Unable to generate summary',
        messageCount: messages.length,
        conversationStart: messages[0].created_at,
        conversationEnd: messages[messages.length - 1].created_at
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in summarize-chat:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        summary: null 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
