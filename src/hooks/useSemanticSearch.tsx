import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useSemanticSearch = () => {
  const { toast } = useToast();

  useEffect(() => {
    // Listen for new messages to generate embeddings
    const channel = supabase
      .channel('new-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          const message = payload.new;
          
          // Only generate embeddings for text messages
          if (message.content && message.content.trim().length > 0) {
            try {
              await supabase.functions.invoke('generate-embedding', {
                body: {
                  messageId: message.id,
                  content: message.content,
                },
              });
              console.log('Embedding generated for message:', message.id);
            } catch (error) {
              console.error('Failed to generate embedding:', error);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const generateEmbeddingForMessage = async (messageId: string, content: string) => {
    try {
      const { error } = await supabase.functions.invoke('generate-embedding', {
        body: { messageId, content },
      });

      if (error) {
        throw error;
      }

      console.log('Embedding generated successfully');
      return true;
    } catch (error) {
      console.error('Error generating embedding:', error);
      toast({
        title: 'Indexing failed',
        description: 'Failed to index message for search',
        variant: 'destructive',
      });
      return false;
    }
  };

  return { generateEmbeddingForMessage };
};
