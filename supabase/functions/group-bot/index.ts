import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conversationId, messages, mode, persona, command, auto_translate, target_language } = await req.json();
    
    console.log('🤖 GroupBotAI request:', { conversationId, mode, persona, command, auto_translate, target_language, messageCount: messages?.length });

    if (!conversationId || !messages || !mode) {
      throw new Error('Missing required fields: conversationId, messages, or mode');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Build system prompt based on mode, persona, and auto_translate
    const systemPrompt = buildSystemPrompt(mode, persona, auto_translate, target_language);
    console.log('📝 Using mode:', mode, 'persona:', persona, 'auto_translate:', auto_translate);

    // Format messages for AI
    const formattedMessages = messages.map((msg: any) => ({
      role: 'user',
      content: `[${msg.sender_name} at ${new Date(msg.created_at).toLocaleTimeString()}]: ${msg.content}`
    }));

    // Add command if present
    if (command) {
      formattedMessages.push({
        role: 'user',
        content: `Command: ${command}`
      });
    }

    // Define tools for structured output
    const tools = [
      {
        type: "function",
        function: {
          name: "bot_response",
          description: "Provide a structured bot response",
          parameters: {
            type: "object",
            properties: {
              mode: {
                type: "string",
                enum: ["assistant", "knowledge", "moderator", "persona", "translation"]
              },
              primary_response: {
                type: "string",
                description: "The main bot response"
              },
              alternatives: {
                type: "array",
                items: { type: "string" },
                description: "Alternative responses or suggestions"
              },
              actions: {
                type: "array",
                items: {
                  type: "string",
                  enum: ["reminder", "task", "summary", "moderation", "translation"]
                },
                description: "Actions to be taken"
              },
              confidence: {
                type: "number",
                minimum: 0,
                maximum: 1,
                description: "Confidence score"
              }
            },
            required: ["mode", "primary_response", "confidence"],
            additionalProperties: false
          }
        }
      }
    ];

    console.log('🚀 Calling Lovable AI...');
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...formattedMessages
        ],
        tools,
        tool_choice: { type: "function", function: { name: "bot_response" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits depleted. Please add credits to your workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ AI response received');

    // Extract tool call result
    const toolCall = data.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('No tool call in AI response');
    }

    const result = JSON.parse(toolCall.function.arguments);
    console.log('📦 Parsed result:', result);

    // Store interaction
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (user) {
      await supabase.from('bot_interactions').insert({
        conversation_id: conversationId,
        user_id: user.id,
        mode: result.mode,
        command,
        response: result.primary_response,
        confidence: result.confidence
      });
      console.log('💾 Interaction stored');
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function buildSystemPrompt(mode: string, persona: string, auto_translate: boolean = false, target_language: string = 'en'): string {
  const translationNote = auto_translate 
    ? `\n\nAUTO-TRANSLATION ENABLED: If messages are in a language other than ${target_language}, automatically translate them to ${target_language} in your response. Mention the original language detected.`
    : '';

  const basePrompt = `You are GroupBotAI, a helpful chatbot participant in group conversations. You analyze messages and respond naturally as a group member.

Current mode: ${mode}
Current persona: ${persona}${translationNote}

Key behaviors:
- Be concise and natural (1-3 sentences unless summarizing)
- Use the persona to guide your tone and style
- Focus on the specific mode's purpose
- Always provide confidence scores
- Suggest alternatives when helpful`;

  const modePrompts = {
    assistant: `
ASSISTANT MODE: Help manage tasks, reminders, and summaries.
- Track action items from discussions
- Summarize key points when asked
- Set reminders for important dates/tasks
- Organize information clearly`,

    knowledge: `
KNOWLEDGE MODE: Answer questions using conversation context.
- Reference previous messages when relevant
- Admit when you don't have enough context
- Ask clarifying questions if needed
- Provide accurate, helpful information`,

    moderator: `
MODERATOR MODE: Maintain a positive, respectful environment.
- Identify potentially toxic or offensive language
- Suggest polite rewrites for problematic messages
- NEVER block or censor - only suggest improvements
- Be gentle and constructive in feedback`,

    persona: `
PERSONA MODE: Embody the selected personality.
Personas:
- professional: Clear, formal, business-focused
- funny: Light-hearted, witty, uses appropriate humor
- tutor: Educational, patient, explains concepts
- motivator: Encouraging, energetic, uplifting

Maintain consistency with the chosen persona while being helpful.`,

    translation: `
TRANSLATION MODE: Translate messages accurately.
- Preserve original meaning and tone
- Indicate the source and target languages
- Handle idioms and cultural context appropriately
- Maintain formality level from original`
  };

  return `${basePrompt}\n\n${modePrompts[mode as keyof typeof modePrompts] || modePrompts.assistant}`;
}
