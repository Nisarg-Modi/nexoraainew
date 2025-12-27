import { useState, useRef, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Users, LogOut, BellOff, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

interface SwipeableGroupItemProps {
  group: {
    id: string;
    group_name: string;
    group_avatar_url: string | null;
    participant_count: number;
  };
  unreadCount?: number;
  isMuted?: boolean;
  onStartChat: () => void;
  onLeave: () => void;
  onToggleMute: () => void;
}

const SWIPE_THRESHOLD = 80;
const MAX_SWIPE = 120;

const SwipeableGroupItem = ({
  group,
  unreadCount = 0,
  isMuted = false,
  onStartChat,
  onLeave,
  onToggleMute,
}: SwipeableGroupItemProps) => {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = translateX;
    setIsDragging(true);
  }, [translateX]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    
    const diff = e.touches[0].clientX - startXRef.current;
    const newTranslate = currentXRef.current + diff;
    
    // Clamp the translation
    const clampedTranslate = Math.max(-MAX_SWIPE, Math.min(MAX_SWIPE, newTranslate));
    setTranslateX(clampedTranslate);
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    
    // Snap to action or reset
    if (translateX < -SWIPE_THRESHOLD) {
      // Swiped left - show leave
      setTranslateX(-MAX_SWIPE);
    } else if (translateX > SWIPE_THRESHOLD) {
      // Swiped right - show mute
      setTranslateX(MAX_SWIPE);
    } else {
      // Reset
      setTranslateX(0);
    }
  }, [translateX]);

  const handleActionClick = (action: 'mute' | 'leave') => {
    if (action === 'mute') {
      setTranslateX(0);
      onToggleMute();
    } else {
      // Show confirmation dialog for leave
      setShowLeaveConfirm(true);
    }
  };

  const confirmLeave = () => {
    setShowLeaveConfirm(false);
    setTranslateX(0);
    onLeave();
  };

  const cancelLeave = () => {
    setShowLeaveConfirm(false);
    setTranslateX(0);
  };

  const handleClick = () => {
    if (Math.abs(translateX) < 10) {
      onStartChat();
    }
  };

  return (
    <>
      <AlertDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave <span className="font-semibold">{group.group_name}</span>? You'll need to be invited again to rejoin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelLeave}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLeave} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Leave Group
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div 
        ref={containerRef}
        className="relative overflow-hidden border-b border-border/50"
      >
        {/* Left action (Mute/Unmute) - shown when swiping right */}
        <div 
          className={cn(
            "absolute inset-y-0 left-0 flex items-center justify-start px-4 transition-opacity",
            isMuted ? "bg-primary" : "bg-muted-foreground",
            translateX > 20 ? "opacity-100" : "opacity-0"
          )}
          style={{ width: MAX_SWIPE }}
        >
          <button
            onClick={() => handleActionClick('mute')}
            className="flex flex-col items-center gap-1 text-white"
          >
            {isMuted ? (
              <>
                <Bell className="w-6 h-6" />
                <span className="text-xs font-medium">Unmute</span>
              </>
            ) : (
              <>
                <BellOff className="w-6 h-6" />
                <span className="text-xs font-medium">Mute</span>
              </>
            )}
          </button>
        </div>

        {/* Right action (Leave) - shown when swiping left */}
        <div 
          className={cn(
            "absolute inset-y-0 right-0 flex items-center justify-end px-4 bg-destructive transition-opacity",
            translateX < -20 ? "opacity-100" : "opacity-0"
          )}
          style={{ width: MAX_SWIPE }}
        >
          <button
            onClick={() => handleActionClick('leave')}
            className="flex flex-col items-center gap-1 text-destructive-foreground"
          >
            <LogOut className="w-6 h-6" />
            <span className="text-xs font-medium">Leave</span>
          </button>
        </div>

        {/* Main content */}
        <div
          className={cn(
            "flex items-center gap-3 px-4 py-3 bg-background cursor-pointer",
            !isDragging && "transition-transform duration-200"
          )}
          style={{ transform: `translateX(${translateX}px)` }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={handleClick}
        >
          {/* Avatar */}
          <Avatar className="w-12 h-12 flex-shrink-0">
            <AvatarImage src={group.group_avatar_url || undefined} />
            <AvatarFallback className="bg-primary text-white font-semibold">
              <Users className="w-6 h-6" />
            </AvatarFallback>
          </Avatar>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="font-semibold truncate text-foreground">
                  {group.group_name}
                </h3>
                {isMuted && (
                  <BellOff className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                )}
              </div>
              <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground truncate flex-1">
                {group.participant_count} members
              </p>
              {unreadCount > 0 && (
                <Badge className="bg-accent text-accent-foreground rounded-full w-5 h-5 flex items-center justify-center p-0 text-xs ml-2">
                  {unreadCount}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SwipeableGroupItem;
