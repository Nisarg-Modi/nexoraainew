import { useState, useRef, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Star, Archive, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SwipeableContactItemProps {
  contact: {
    id: string;
    contact_user_id: string;
    contact_name: string | null;
    is_favourite: boolean;
    profiles: {
      display_name: string | null;
      status: string | null;
      avatar_url: string | null;
    };
  };
  displayName: string;
  emoji: string;
  statusMsg: string;
  avatarColor: string;
  unreadCount: number;
  onStartChat: () => void;
  onToggleFavourite: (e: React.MouseEvent) => void;
  onArchive: () => void;
  onDelete: () => void;
}

const SWIPE_THRESHOLD = 80;
const MAX_SWIPE = 120;

const SwipeableContactItem = ({
  contact,
  displayName,
  emoji,
  statusMsg,
  avatarColor,
  unreadCount,
  onStartChat,
  onToggleFavourite,
  onArchive,
  onDelete,
}: SwipeableContactItemProps) => {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
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
      // Swiped left - show delete
      setTranslateX(-MAX_SWIPE);
    } else if (translateX > SWIPE_THRESHOLD) {
      // Swiped right - show archive
      setTranslateX(MAX_SWIPE);
    } else {
      // Reset
      setTranslateX(0);
    }
  }, [translateX]);

  const handleActionClick = (action: 'archive' | 'delete') => {
    setTranslateX(0);
    if (action === 'archive') {
      onArchive();
    } else {
      onDelete();
    }
  };

  const handleClick = () => {
    if (Math.abs(translateX) < 10) {
      onStartChat();
    }
  };

  return (
    <div 
      ref={containerRef}
      className="relative overflow-hidden border-b border-border/50"
    >
      {/* Left action (Archive) - shown when swiping right */}
      <div 
        className={cn(
          "absolute inset-y-0 left-0 flex items-center justify-start px-4 bg-primary transition-opacity",
          translateX > 20 ? "opacity-100" : "opacity-0"
        )}
        style={{ width: MAX_SWIPE }}
      >
        <button
          onClick={() => handleActionClick('archive')}
          className="flex flex-col items-center gap-1 text-primary-foreground"
        >
          <Archive className="w-6 h-6" />
          <span className="text-xs font-medium">Archive</span>
        </button>
      </div>

      {/* Right action (Delete) - shown when swiping left */}
      <div 
        className={cn(
          "absolute inset-y-0 right-0 flex items-center justify-end px-4 bg-destructive transition-opacity",
          translateX < -20 ? "opacity-100" : "opacity-0"
        )}
        style={{ width: MAX_SWIPE }}
      >
        <button
          onClick={() => handleActionClick('delete')}
          className="flex flex-col items-center gap-1 text-destructive-foreground"
        >
          <Trash2 className="w-6 h-6" />
          <span className="text-xs font-medium">Delete</span>
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
          <AvatarImage src={contact.profiles?.avatar_url || undefined} />
          <AvatarFallback className={`${avatarColor} text-white font-semibold`}>
            {displayName[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold truncate text-foreground">
              {displayName} {emoji}
            </h3>
            <div className="flex items-center gap-1 flex-shrink-0 ml-2">
              <span className="text-xs text-muted-foreground">
                {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavourite(e);
                }}
                className="p-1 hover:bg-muted/50 rounded-full transition-colors"
              >
                <Star 
                  className={cn(
                    "w-4 h-4 transition-colors",
                    contact.is_favourite 
                      ? "fill-yellow-400 text-yellow-400" 
                      : "text-muted-foreground hover:text-yellow-400"
                  )} 
                />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground truncate flex-1">
              {statusMsg}
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
  );
};

export default SwipeableContactItem;
