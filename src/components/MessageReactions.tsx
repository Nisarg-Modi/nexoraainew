import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SmilePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Reaction {
  emoji: string;
  count: number;
  userReacted: boolean;
}

interface MessageReactionsProps {
  messageId: string;
  currentUserId: string | null;
}

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

const MessageReactions = ({ messageId, currentUserId }: MessageReactionsProps) => {
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    fetchReactions();
    const cleanup = subscribeToReactions();
    return cleanup;
  }, [messageId, currentUserId]);

  const fetchReactions = async () => {
    const { data, error } = await supabase
      .from('message_reactions')
      .select('emoji, user_id')
      .eq('message_id', messageId);

    if (error) {
      console.error('Error fetching reactions:', error);
      return;
    }

    if (data) {
      const reactionMap = new Map<string, { count: number; userReacted: boolean }>();
      
      data.forEach((r) => {
        const existing = reactionMap.get(r.emoji) || { count: 0, userReacted: false };
        reactionMap.set(r.emoji, {
          count: existing.count + 1,
          userReacted: existing.userReacted || r.user_id === currentUserId,
        });
      });

      const reactionsList: Reaction[] = Array.from(reactionMap.entries()).map(([emoji, data]) => ({
        emoji,
        count: data.count,
        userReacted: data.userReacted,
      }));

      setReactions(reactionsList);
    }
  };

  const subscribeToReactions = () => {
    const channel = supabase
      .channel(`reactions-${messageId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
          filter: `message_id=eq.${messageId}`,
        },
        () => {
          fetchReactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const toggleReaction = async (emoji: string) => {
    if (!currentUserId) return;

    const existingReaction = reactions.find(r => r.emoji === emoji && r.userReacted);

    if (existingReaction) {
      // Remove reaction
      const { error } = await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', currentUserId)
        .eq('emoji', emoji);

      if (error) {
        console.error('Error removing reaction:', error);
      }
    } else {
      // Add reaction
      const { error } = await supabase
        .from('message_reactions')
        .insert({
          message_id: messageId,
          user_id: currentUserId,
          emoji,
        });

      if (error) {
        console.error('Error adding reaction:', error);
      }
    }
    
    setShowPicker(false);
  };

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {reactions.map((reaction) => (
        <Button
          key={reaction.emoji}
          variant="ghost"
          size="sm"
          className={cn(
            "h-6 px-2 py-0 text-xs rounded-full",
            reaction.userReacted 
              ? "bg-primary/20 border border-primary/30" 
              : "bg-muted/50 hover:bg-muted"
          )}
          onClick={() => toggleReaction(reaction.emoji)}
        >
          <span>{reaction.emoji}</span>
          <span className="ml-1 text-muted-foreground">{reaction.count}</span>
        </Button>
      ))}
      
      <Popover open={showPicker} onOpenChange={setShowPicker}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <SmilePlus className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="flex gap-1">
            {QUICK_REACTIONS.map((emoji) => (
              <Button
                key={emoji}
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-lg hover:bg-muted"
                onClick={() => toggleReaction(emoji)}
              >
                {emoji}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default MessageReactions;
