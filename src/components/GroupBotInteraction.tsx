import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Bot, Send, Sparkles, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface GroupBotInteractionProps {
  conversationId: string;
  recentMessages: any[];
  botSettings?: any;
}

interface BotResponse {
  mode: string;
  primary_response: string;
  alternatives?: string[];
  actions?: string[];
  confidence: number;
}

export const GroupBotInteraction = ({ conversationId, recentMessages, botSettings }: GroupBotInteractionProps) => {
  const { toast } = useToast();
  const [command, setCommand] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<BotResponse | null>(null);

  const invokeBot = async (customCommand?: string) => {
    const cmdToUse = customCommand || command;
    if (!cmdToUse && !customCommand) return;

    setLoading(true);
    setResponse(null);

    try {
      console.log('🤖 Invoking GroupBotAI...');
      const { data, error } = await supabase.functions.invoke('group-bot', {
        body: {
          conversationId,
          messages: recentMessages.slice(-20), // Last 20 messages
          mode: botSettings?.default_mode || 'assistant',
          persona: botSettings?.persona || 'professional',
          command: cmdToUse,
          auto_translate: botSettings?.auto_translate || false,
          target_language: botSettings?.target_language || 'en',
        },
      });

      if (error) throw error;

      console.log('✅ Bot response:', data);
      setResponse(data);
      setCommand('');

      // Insert bot message into conversation
      const { error: insertError } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: (await supabase.auth.getUser()).data.user?.id,
        content: data.primary_response,
        ai_generated: true,
      });

      if (insertError) {
        console.error('Error inserting bot message:', insertError);
      }

    } catch (error: any) {
      console.error('❌ Bot error:', error);
      
      let errorMessage = 'Failed to get bot response';
      if (error.message?.includes('Rate limit')) {
        errorMessage = 'Too many requests. Please wait a moment.';
      } else if (error.message?.includes('credits')) {
        errorMessage = 'AI credits depleted. Please add credits.';
      }
      
      toast({
        title: 'Bot Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const quickCommands = [
    { label: 'Summarize', command: '@bot summarize the last discussion' },
    { label: 'Tasks', command: '@bot list all tasks mentioned' },
    { label: 'Translate', command: '@bot translate this to English' },
  ];

  return (
    <div className="space-y-4">
      {response && (
        <Card className="p-4 bg-primary/5 border-primary/20">
          <div className="flex items-start gap-3">
            <Bot className="w-5 h-5 text-primary mt-1" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">GroupBotAI</span>
                <Badge variant="secondary" className="text-xs">
                  {response.mode}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {Math.round(response.confidence * 100)}% confident
                </span>
              </div>
              
              <p className="text-sm">{response.primary_response}</p>

              {response.alternatives && response.alternatives.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Alternatives:</p>
                  {response.alternatives.map((alt, idx) => (
                    <p key={idx} className="text-xs text-muted-foreground pl-3 border-l-2 border-primary/20">
                      {alt}
                    </p>
                  ))}
                </div>
              )}

              {response.actions && response.actions.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {response.actions.map((action, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      <Sparkles className="w-3 h-3 mr-1" />
                      {action}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      <div className="flex gap-2">
        <Input
          placeholder="@bot your command..."
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && !loading && invokeBot()}
          disabled={loading}
        />
        <Button
          onClick={() => invokeBot()}
          disabled={loading || !command}
          size="icon"
        >
          {loading ? (
            <Bot className="w-4 h-4 animate-pulse" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {quickCommands.map((cmd, idx) => (
          <Button
            key={idx}
            variant="outline"
            size="sm"
            onClick={() => invokeBot(cmd.command)}
            disabled={loading}
          >
            {cmd.label}
          </Button>
        ))}
      </div>

      {!botSettings?.enabled && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertCircle className="w-4 h-4" />
          <span>GroupBotAI is disabled for this conversation</span>
        </div>
      )}
    </div>
  );
};
