import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Users, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Stream {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  follower_count: number;
  is_verified: boolean;
  created_by: string;
}

interface ExploreStreamsProps {
  trigger?: React.ReactNode;
  onFollowed: () => void;
  followedStreamIds: Set<string>;
}

export const ExploreStreams = ({ trigger, onFollowed, followedStreamIds }: ExploreStreamsProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [streams, setStreams] = useState<Stream[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [followingId, setFollowingId] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchStreams = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('streams')
        .select('*')
        .order('follower_count', { ascending: false })
        .limit(50);

      if (search.trim()) {
        query = query.ilike('name', `%${search.trim()}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setStreams(data || []);
    } catch (error) {
      console.error("Error fetching streams:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchStreams();
    }
  }, [open, search]);

  const handleFollow = async (streamId: string) => {
    if (!user) return;

    setFollowingId(streamId);
    try {
      const { error } = await supabase
        .from('stream_followers')
        .insert({
          stream_id: streamId,
          user_id: user.id,
        });

      if (error) throw error;

      toast.success("Following stream!");
      onFollowed();
    } catch (error: any) {
      console.error("Error following stream:", error);
      toast.error(error.message || "Failed to follow");
    } finally {
      setFollowingId(null);
    }
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

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="text-primary">
            Explore
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Explore Streams</DialogTitle>
        </DialogHeader>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search streams..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="max-h-[400px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : streams.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {search ? "No streams found" : "No streams yet. Create one!"}
            </div>
          ) : (
            <div className="space-y-2">
              {streams.map((stream) => {
                const isFollowing = followedStreamIds.has(stream.id);
                const isOwner = stream.created_by === user?.id;
                
                return (
                  <div
                    key={stream.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <Avatar className="w-12 h-12 rounded-full">
                      <AvatarImage src={stream.avatar_url || ""} />
                      <AvatarFallback className="bg-primary/20 text-primary text-sm font-semibold">
                        {getInitials(stream.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-medium text-foreground truncate">
                          {stream.name}
                        </h3>
                        {stream.is_verified && (
                          <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 fill-primary stroke-primary-foreground" />
                        )}
                        {isOwner && (
                          <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                            You
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Users className="h-3 w-3" />
                        <span>{formatFollowers(stream.follower_count)} followers</span>
                      </div>
                    </div>
                    {!isOwner && (
                      <Button
                        variant={isFollowing ? "secondary" : "default"}
                        size="sm"
                        onClick={() => !isFollowing && handleFollow(stream.id)}
                        disabled={followingId === stream.id || isFollowing}
                        className="shrink-0 rounded-full"
                      >
                        {followingId === stream.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isFollowing ? (
                          "Following"
                        ) : (
                          "Follow"
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
