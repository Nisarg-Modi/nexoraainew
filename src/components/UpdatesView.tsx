import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Search, MoreVertical, CheckCircle2, Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface MomentItem {
  id: string;
  name: string;
  avatarUrl?: string;
  hasVideo?: boolean;
  isOwn?: boolean;
}

interface StreamItem {
  id: string;
  name: string;
  avatarUrl?: string;
  followers: string;
  isVerified?: boolean;
  isFollowing?: boolean;
}

interface HubItem {
  id: string;
  name: string;
  avatarUrl?: string;
  description: string;
}

// Mock data for demonstration
const mockMoments: MomentItem[] = [
  { id: "own", name: "Add moment", isOwn: true },
  { id: "1", name: "Sarah K.", avatarUrl: "" },
  { id: "2", name: "Mike T.", avatarUrl: "", hasVideo: true },
  { id: "3", name: "Emma W.", avatarUrl: "" },
  { id: "4", name: "John D.", avatarUrl: "" },
  { id: "5", name: "Lisa M.", avatarUrl: "" },
  { id: "6", name: "Chris P.", avatarUrl: "" },
];

const mockHubs: HubItem[] = [
  { id: "1", name: "Tech Enthusiasts", avatarUrl: "", description: "You joined 'Tech Enthusiasts'" },
  { id: "2", name: "Photography Club", avatarUrl: "", description: "You joined 'Photography Club'" },
];

const mockStreams: StreamItem[] = [
  { id: "1", name: "Tech Updates", followers: "610K", isVerified: true, isFollowing: false },
  { id: "2", name: "Daily Insights", followers: "8.2M", isVerified: true, isFollowing: false },
  { id: "3", name: "Creative Corner", followers: "121K", isVerified: true, isFollowing: false },
  { id: "4", name: "Mindful Living", followers: "7.9M", isVerified: true, isFollowing: false },
  { id: "5", name: "News Flash", followers: "613K", isVerified: true, isFollowing: false },
  { id: "6", name: "Sports Central", followers: "354K", isVerified: true, isFollowing: false },
];

export const UpdatesView = () => {
  const [followingStreams, setFollowingStreams] = useState<Set<string>>(new Set());

  const handleFollowStream = (streamId: string) => {
    setFollowingStreams(prev => {
      const next = new Set(prev);
      if (next.has(streamId)) {
        next.delete(streamId);
      } else {
        next.add(streamId);
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h1 className="text-xl font-semibold text-foreground">Updates</h1>
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
                {mockMoments.map((moment) => (
                  <MomentCard key={moment.id} moment={moment} />
                ))}
              </div>
            </div>
          </section>

          {/* Hub Section */}
          <section className="py-4">
            <div className="flex items-center justify-between px-4 mb-3">
              <h2 className="text-base font-semibold text-foreground">Hub</h2>
              <Button variant="ghost" size="sm" className="text-primary text-sm font-medium h-8 px-3">
                Explore
              </Button>
            </div>
            <div className="space-y-0">
              {mockHubs.map((hub) => (
                <HubCard key={hub.id} hub={hub} />
              ))}
            </div>
          </section>

          {/* Streams Section */}
          <section className="py-4">
            <div className="flex items-center justify-between px-4 mb-1">
              <h2 className="text-base font-semibold text-foreground">Streams</h2>
              <Button variant="ghost" size="sm" className="text-primary text-sm font-medium h-8 px-3">
                Explore
              </Button>
            </div>
            <p className="text-sm text-muted-foreground px-4 mb-3">Find streams to follow</p>
            <div className="space-y-0">
              {mockStreams.map((stream) => (
                <StreamCard 
                  key={stream.id} 
                  stream={stream} 
                  isFollowing={followingStreams.has(stream.id)}
                  onFollow={() => handleFollowStream(stream.id)}
                />
              ))}
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
};

const MomentCard = ({ moment }: { moment: MomentItem }) => {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (moment.isOwn) {
    return (
      <div className="flex flex-col items-center gap-1.5 min-w-[72px]">
        <div className="relative">
          <div className="w-16 h-16 rounded-xl border-2 border-dashed border-primary/40 bg-card flex items-center justify-center">
            <Avatar className="w-14 h-14 rounded-lg">
              <AvatarImage src="" />
              <AvatarFallback className="bg-muted rounded-lg text-muted-foreground text-lg">
                You
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-lg">
            <Plus className="w-4 h-4 text-primary-foreground" />
          </div>
        </div>
        <span className="text-xs text-muted-foreground text-center truncate w-16">
          Add moment
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1.5 min-w-[72px] cursor-pointer group">
      <div className="relative">
        <div className="w-16 h-16 rounded-xl p-0.5 bg-gradient-to-br from-primary via-accent to-secondary">
          <div className="w-full h-full rounded-[10px] bg-card p-0.5">
            <Avatar className="w-full h-full rounded-lg">
              <AvatarImage src={moment.avatarUrl} className="object-cover" />
              <AvatarFallback className="bg-muted rounded-lg text-foreground text-sm font-medium">
                {getInitials(moment.name)}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
        {moment.hasVideo && (
          <div className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full bg-background/80 flex items-center justify-center">
            <Play className="w-2.5 h-2.5 text-foreground fill-foreground" />
          </div>
        )}
      </div>
      <span className="text-xs text-muted-foreground text-center truncate w-16 group-hover:text-foreground transition-colors">
        {moment.name}
      </span>
    </div>
  );
};

const HubCard = ({ hub }: { hub: HubItem }) => {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer">
      <Avatar className="w-12 h-12 rounded-xl">
        <AvatarImage src={hub.avatarUrl} />
        <AvatarFallback className="bg-secondary/20 text-secondary rounded-xl text-sm font-semibold">
          {getInitials(hub.name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-foreground truncate">{hub.name}</h3>
        <p className="text-sm text-muted-foreground truncate">{hub.description}</p>
      </div>
    </div>
  );
};

const StreamCard = ({ 
  stream, 
  isFollowing, 
  onFollow 
}: { 
  stream: StreamItem; 
  isFollowing: boolean;
  onFollow: () => void;
}) => {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
      <Avatar className="w-12 h-12 rounded-full">
        <AvatarImage src={stream.avatarUrl} />
        <AvatarFallback className="bg-primary/20 text-primary text-sm font-semibold">
          {getInitials(stream.name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <h3 className="font-medium text-foreground truncate">{stream.name}</h3>
          {stream.isVerified && (
            <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 fill-primary stroke-primary-foreground" />
          )}
        </div>
        <p className="text-sm text-muted-foreground">{stream.followers} followers</p>
      </div>
      <Button
        variant={isFollowing ? "secondary" : "default"}
        size="sm"
        onClick={onFollow}
        className={cn(
          "h-8 px-4 text-sm font-medium rounded-full",
          isFollowing 
            ? "bg-muted text-foreground hover:bg-muted/80" 
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        )}
      >
        {isFollowing ? "Following" : "Follow"}
      </Button>
    </div>
  );
};

export default UpdatesView;
