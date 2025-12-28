import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, Send, Loader2, Trash2, Users, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Stream {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  follower_count: number;
  is_verified: boolean;
  created_by: string;
}

interface StreamPost {
  id: string;
  stream_id: string;
  content: string;
  media_url: string | null;
  media_type: string;
  created_at: string;
}

interface ViewStreamDialogProps {
  stream: Stream | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isOwner: boolean;
  isFollowing: boolean;
  onFollow: () => void;
  onUnfollow: () => void;
}

export const ViewStreamDialog = ({
  stream,
  open,
  onOpenChange,
  isOwner,
  isFollowing,
  onFollow,
  onUnfollow,
}: ViewStreamDialogProps) => {
  const [posts, setPosts] = useState<StreamPost[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newPost, setNewPost] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const { user } = useAuth();

  const fetchPosts = async () => {
    if (!stream) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('stream_posts')
        .select('*')
        .eq('stream_id', stream.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error("Error fetching posts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open && stream) {
      fetchPosts();
    }
  }, [open, stream]);

  const handlePost = async () => {
    if (!stream || !user || !newPost.trim()) return;

    setIsPosting(true);
    try {
      const { error } = await supabase
        .from('stream_posts')
        .insert({
          stream_id: stream.id,
          content: newPost.trim(),
        });

      if (error) throw error;

      toast.success("Posted to stream!");
      setNewPost("");
      fetchPosts();
    } catch (error: any) {
      console.error("Error posting:", error);
      toast.error("Failed to post");
    } finally {
      setIsPosting(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      const { error } = await supabase
        .from('stream_posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;

      setPosts(prev => prev.filter(p => p.id !== postId));
      toast.success("Post deleted");
    } catch (error) {
      console.error("Error deleting post:", error);
      toast.error("Failed to delete post");
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatFollowers = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  if (!stream) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col p-0">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Avatar className="w-14 h-14 rounded-full">
              <AvatarImage src={stream.avatar_url || ""} />
              <AvatarFallback className="bg-primary/20 text-primary text-lg font-semibold">
                {getInitials(stream.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="font-semibold text-lg truncate">{stream.name}</h2>
                {stream.is_verified && (
                  <CheckCircle2 className="w-5 h-5 text-primary fill-primary stroke-primary-foreground" />
                )}
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Users className="h-3 w-3" />
                <span>{formatFollowers(stream.follower_count)} followers</span>
              </div>
            </div>
            {!isOwner && (
              <Button
                variant={isFollowing ? "outline" : "default"}
                size="sm"
                onClick={isFollowing ? onUnfollow : onFollow}
                className="rounded-full"
              >
                {isFollowing ? "Unfollow" : "Follow"}
              </Button>
            )}
          </div>
          {stream.description && (
            <p className="text-sm text-muted-foreground mt-2">{stream.description}</p>
          )}
        </div>

        {/* Posts */}
        <ScrollArea className="flex-1 p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No posts yet</p>
              {isOwner && (
                <p className="text-sm mt-1">Share your first update!</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <div key={post.id} className="bg-muted/30 rounded-lg p-4 group">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-foreground whitespace-pre-wrap">{post.content}</p>
                    {isOwner && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeletePost(post.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Post input (only for owner) */}
        {isOwner && (
          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <Textarea
                placeholder="Share an update with your followers..."
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                className="min-h-[60px] resize-none"
                maxLength={1000}
              />
              <Button
                size="icon"
                onClick={handlePost}
                disabled={!newPost.trim() || isPosting}
                className="shrink-0"
              >
                {isPosting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
