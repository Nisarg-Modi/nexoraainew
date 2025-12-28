import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Users, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Community {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  member_count: number;
  is_public: boolean;
  created_by: string;
}

interface ExploreCommunitiesProps {
  trigger?: React.ReactNode;
  onJoined: () => void;
  joinedCommunityIds: Set<string>;
}

export const ExploreCommunities = ({ trigger, onJoined, joinedCommunityIds }: ExploreCommunitiesProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [communities, setCommunities] = useState<Community[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchCommunities = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('communities')
        .select('*')
        .eq('is_public', true)
        .order('member_count', { ascending: false })
        .limit(50);

      if (search.trim()) {
        query = query.ilike('name', `%${search.trim()}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setCommunities(data || []);
    } catch (error) {
      console.error("Error fetching communities:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchCommunities();
    }
  }, [open, search]);

  const handleJoin = async (communityId: string) => {
    if (!user) return;

    setJoiningId(communityId);
    try {
      const { error } = await supabase
        .from('community_members')
        .insert({
          community_id: communityId,
          user_id: user.id,
          role: 'member',
        });

      if (error) throw error;

      toast.success("Joined community!");
      onJoined();
    } catch (error: any) {
      console.error("Error joining community:", error);
      toast.error(error.message || "Failed to join");
    } finally {
      setJoiningId(null);
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
          <DialogTitle>Explore Communities</DialogTitle>
        </DialogHeader>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search communities..."
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
          ) : communities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {search ? "No communities found" : "No public communities yet"}
            </div>
          ) : (
            <div className="space-y-2">
              {communities.map((community) => {
                const isJoined = joinedCommunityIds.has(community.id);
                
                return (
                  <div
                    key={community.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <Avatar className="w-12 h-12 rounded-xl">
                      <AvatarImage src={community.avatar_url || ""} />
                      <AvatarFallback className="bg-primary/20 text-primary rounded-xl text-sm font-semibold">
                        {getInitials(community.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground truncate">
                        {community.name}
                      </h3>
                      {community.description && (
                        <p className="text-sm text-muted-foreground truncate">
                          {community.description}
                        </p>
                      )}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Users className="h-3 w-3" />
                        <span>{community.member_count} members</span>
                      </div>
                    </div>
                    <Button
                      variant={isJoined ? "secondary" : "default"}
                      size="sm"
                      onClick={() => !isJoined && handleJoin(community.id)}
                      disabled={joiningId === community.id || isJoined}
                      className="shrink-0"
                    >
                      {joiningId === community.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isJoined ? (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Joined
                        </>
                      ) : (
                        "Join"
                      )}
                    </Button>
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
