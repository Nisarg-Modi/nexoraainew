import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, MoreVertical, CheckCircle2, Play, Loader2, Users, LogOut, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CreateMomentDialog } from "./CreateMomentDialog";
import { ViewMomentDialog } from "./ViewMomentDialog";
import { CreateCommunityDialog } from "./CreateCommunityDialog";
import { ExploreCommunities } from "./ExploreCommunities";
import { CreateStreamDialog } from "./CreateStreamDialog";
import { ExploreStreams } from "./ExploreStreams";
import { ViewStreamDialog } from "./ViewStreamDialog";
import { useCommunities } from "@/hooks/useCommunities";
import { useStreams } from "@/hooks/useStreams";
import { toast } from "sonner";

interface Moment {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string;
  created_at: string;
  expires_at: string;
  views_count: number;
  profile?: {
    display_name: string;
    avatar_url: string | null;
  };
}

interface GroupedMoments {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  moments: Moment[];
  isOwn: boolean;
}

export const UpdatesView = () => {
  const [groupedMoments, setGroupedMoments] = useState<GroupedMoments[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedMoments, setSelectedMoments] = useState<Moment[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedStream, setSelectedStream] = useState<any>(null);
  const [streamDialogOpen, setStreamDialogOpen] = useState(false);
  const { user } = useAuth();
  const { memberships, isLoading: isLoadingCommunities, refetch: refetchCommunities, leaveCommunity, joinedCommunityIds } = useCommunities();
  const { allStreams, isLoading: isLoadingStreams, refetch: refetchStreams, followStream, unfollowStream, followedStreamIds } = useStreams();

  const fetchMoments = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data: moments, error } = await supabase
        .from('moments')
        .select('*')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!moments || moments.length === 0) {
        setGroupedMoments([]);
        setIsLoading(false);
        return;
      }

      const userIds = [...new Set(moments.map(m => m.user_id))];
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const momentsWithProfiles = moments.map(m => ({
        ...m,
        profile: profileMap.get(m.user_id)
      }));

      const grouped = new Map<string, GroupedMoments>();
      
      momentsWithProfiles.forEach(moment => {
        const userId = moment.user_id;
        if (!grouped.has(userId)) {
          grouped.set(userId, {
            userId,
            displayName: moment.profile?.display_name || "User",
            avatarUrl: moment.profile?.avatar_url || null,
            moments: [],
            isOwn: userId === user.id
          });
        }
        grouped.get(userId)!.moments.push(moment);
      });

      const sortedGroups = Array.from(grouped.values()).sort((a, b) => {
        if (a.isOwn) return -1;
        if (b.isOwn) return 1;
        return new Date(b.moments[0].created_at).getTime() - new Date(a.moments[0].created_at).getTime();
      });

      setGroupedMoments(sortedGroups);
    } catch (error) {
      console.error("Error fetching moments:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMoments();

    const channel = supabase
      .channel('moments-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'moments' },
        () => {
          fetchMoments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleFollowStream = async (streamId: string) => {
    const success = await followStream(streamId);
    if (success) {
      toast.success("Following stream!");
    } else {
      toast.error("Failed to follow stream");
    }
  };

  const handleUnfollowStream = async (streamId: string) => {
    const success = await unfollowStream(streamId);
    if (success) {
      toast.success("Unfollowed stream");
    } else {
      toast.error("Failed to unfollow stream");
    }
  };

  const handleStreamClick = (stream: any) => {
    setSelectedStream(stream);
    setStreamDialogOpen(true);
  };

  const handleMomentClick = (group: GroupedMoments) => {
    setSelectedMoments(group.moments);
    setSelectedIndex(0);
    setViewDialogOpen(true);
  };

  const handleLeaveCommunity = async (communityId: string, communityName: string) => {
    const success = await leaveCommunity(communityId);
    if (success) {
      toast.success(`Left ${communityName}`);
    } else {
      toast.error("Failed to leave community");
    }
  };

  const ownMoments = groupedMoments.find(g => g.isOwn);
  const otherMoments = groupedMoments.filter(g => !g.isOwn);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h1 className="text-xl font-semibold text-foreground">Syncs</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <Search className="h-5 w-5 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <MoreVertical className="h-5 w-5 text-muted-foreground" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="pb-6">
          {/* Moments Section */}
          <section className="py-4">
            <h2 className="text-base font-semibold px-4 mb-3 text-foreground">Moments</h2>
            <div className="relative">
              <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide">
                {ownMoments ? (
                  <MomentCard 
                    group={ownMoments} 
                    onClick={() => handleMomentClick(ownMoments)}
                  />
                ) : (
                  <CreateMomentDialog onMomentCreated={fetchMoments} />
                )}
                
                {ownMoments && (
                  <CreateMomentDialog onMomentCreated={fetchMoments} />
                )}
                
                {otherMoments.map((group) => (
                  <MomentCard 
                    key={group.userId} 
                    group={group}
                    onClick={() => handleMomentClick(group)}
                  />
                ))}

                {isLoading && (
                  <div className="flex items-center justify-center min-w-[72px]">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                )}

                {!isLoading && groupedMoments.length === 0 && (
                  <p className="text-sm text-muted-foreground px-2">
                    No moments yet. Share your first one!
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Hub Section */}
          <section className="py-4">
            <div className="flex items-center justify-between px-4 mb-3">
              <h2 className="text-base font-semibold text-foreground">Hub</h2>
              <div className="flex items-center gap-2">
                <CreateCommunityDialog onCommunityCreated={refetchCommunities} />
                <ExploreCommunities 
                  onJoined={refetchCommunities}
                  joinedCommunityIds={joinedCommunityIds}
                />
              </div>
            </div>
            
            {isLoadingCommunities ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : memberships.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <Users className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  You haven't joined any communities yet
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Create one or explore to find communities
                </p>
              </div>
            ) : (
              <div className="space-y-0">
                {memberships.map((membership) => (
                  <div
                    key={membership.community_id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer group"
                  >
                    <Avatar className="w-12 h-12 rounded-xl">
                      <AvatarImage src={membership.community.avatar_url || ""} />
                      <AvatarFallback className="bg-secondary/20 text-secondary rounded-xl text-sm font-semibold">
                        {getInitials(membership.community.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-foreground truncate">
                          {membership.community.name}
                        </h3>
                        {membership.role === 'owner' && (
                          <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                            Owner
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-3 w-3" />
                        <span>{membership.community.member_count} members</span>
                      </div>
                    </div>
                    {membership.role !== 'owner' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLeaveCommunity(membership.community_id, membership.community.name);
                        }}
                      >
                        <LogOut className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Streams Section */}
          <section className="py-4">
            <div className="flex items-center justify-between px-4 mb-1">
              <h2 className="text-base font-semibold text-foreground">Streams</h2>
              <div className="flex items-center gap-2">
                <CreateStreamDialog onStreamCreated={refetchStreams} />
                <ExploreStreams 
                  onFollowed={refetchStreams}
                  followedStreamIds={followedStreamIds}
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground px-4 mb-3">Broadcast channels you follow</p>
            
            {isLoadingStreams ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : allStreams.filter(s => s.isFollowing || s.isOwner).length === 0 ? (
              <div className="px-4 py-6 text-center">
                <Radio className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  You're not following any streams yet
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Create one or explore to find streams
                </p>
              </div>
            ) : (
              <div className="space-y-0">
                {allStreams.filter(s => s.isFollowing || s.isOwner).map((stream) => (
                  <div
                    key={stream.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => handleStreamClick(stream)}
                  >
                    <Avatar className="w-12 h-12 rounded-full">
                      <AvatarImage src={stream.avatar_url || ""} />
                      <AvatarFallback className="bg-primary/20 text-primary text-sm font-semibold">
                        {getInitials(stream.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-medium text-foreground truncate">{stream.name}</h3>
                        {stream.is_verified && (
                          <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 fill-primary stroke-primary-foreground" />
                        )}
                        {stream.isOwner && (
                          <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                            You
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatFollowers(stream.follower_count)} followers
                      </p>
                    </div>
                    {!stream.isOwner && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnfollowStream(stream.id);
                        }}
                        className="rounded-full"
                      >
                        Following
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </ScrollArea>

      <ViewMomentDialog
        moments={selectedMoments}
        initialIndex={selectedIndex}
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        onMomentDeleted={fetchMoments}
      />

      <ViewStreamDialog
        stream={selectedStream}
        open={streamDialogOpen}
        onOpenChange={setStreamDialogOpen}
        isOwner={selectedStream?.isOwner || false}
        isFollowing={selectedStream?.isFollowing || false}
        onFollow={() => selectedStream && handleFollowStream(selectedStream.id)}
        onUnfollow={() => selectedStream && handleUnfollowStream(selectedStream.id)}
      />
    </div>
  );
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

const MomentCard = ({ group, onClick }: { group: GroupedMoments; onClick: () => void }) => {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const hasMultiple = group.moments.length > 1;
  const latestMoment = group.moments[0];

  return (
    <div 
      className="flex flex-col items-center gap-1.5 min-w-[72px] cursor-pointer group"
      onClick={onClick}
    >
      <div className="relative">
        <div className="w-16 h-16 rounded-xl p-0.5 bg-gradient-to-br from-primary via-accent to-secondary">
          <div className="w-full h-full rounded-[10px] bg-card p-0.5">
            <Avatar className="w-full h-full rounded-lg">
              <AvatarImage src={group.avatarUrl || ""} className="object-cover" />
              <AvatarFallback className="bg-muted rounded-lg text-foreground text-sm font-medium">
                {getInitials(group.displayName)}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
        {latestMoment.media_type === "image" && (
          <div className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full bg-background/80 flex items-center justify-center">
            <Play className="w-2.5 h-2.5 text-foreground fill-foreground" />
          </div>
        )}
        {hasMultiple && (
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center">
            {group.moments.length}
          </div>
        )}
      </div>
      <span className="text-xs text-muted-foreground text-center truncate w-16 group-hover:text-foreground transition-colors">
        {group.isOwn ? "Your story" : group.displayName}
      </span>
    </div>
  );
};

export default UpdatesView;
