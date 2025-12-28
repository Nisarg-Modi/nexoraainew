import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
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

interface ViewMomentDialogProps {
  moments: Moment[];
  initialIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMomentDeleted?: () => void;
}

export const ViewMomentDialog = ({ 
  moments, 
  initialIndex, 
  open, 
  onOpenChange,
  onMomentDeleted 
}: ViewMomentDialogProps) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const { user } = useAuth();

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    if (open && moments[currentIndex]) {
      recordView(moments[currentIndex].id);
    }
  }, [open, currentIndex, moments]);

  const recordView = async (momentId: string) => {
    if (!user) return;
    
    try {
      await supabase
        .from('moment_views')
        .upsert({
          moment_id: momentId,
          viewer_id: user.id,
        }, {
          onConflict: 'moment_id,viewer_id'
        });
    } catch (error) {
      console.error("Error recording view:", error);
    }
  };

  const goNext = () => {
    if (currentIndex < moments.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onOpenChange(false);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleDelete = async () => {
    const moment = moments[currentIndex];
    if (!moment || moment.user_id !== user?.id) return;

    try {
      // Delete media from storage if exists
      if (moment.media_url) {
        const urlParts = moment.media_url.split('/');
        const fileName = urlParts.slice(-2).join('/');
        await supabase.storage.from('moments').remove([fileName]);
      }

      // Delete moment from database
      const { error } = await supabase
        .from('moments')
        .delete()
        .eq('id', moment.id);

      if (error) throw error;

      toast.success("Moment deleted");
      onOpenChange(false);
      onMomentDeleted?.();
    } catch (error: any) {
      console.error("Error deleting moment:", error);
      toast.error("Failed to delete moment");
    }
  };

  if (!moments.length || !moments[currentIndex]) {
    return null;
  }

  const currentMoment = moments[currentIndex];
  const isOwn = currentMoment.user_id === user?.id;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden bg-background/95 backdrop-blur">
        {/* Progress bars */}
        <div className="absolute top-0 left-0 right-0 flex gap-1 p-2 z-10">
          {moments.map((_, idx) => (
            <div
              key={idx}
              className={`h-1 flex-1 rounded-full transition-colors ${
                idx <= currentIndex ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-6 left-0 right-0 flex items-center justify-between px-4 z-10">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10 border-2 border-primary">
              <AvatarImage src={currentMoment.profile?.avatar_url || ""} />
              <AvatarFallback className="bg-primary/20 text-primary text-sm">
                {getInitials(currentMoment.profile?.display_name || "User")}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-sm text-foreground">
                {currentMoment.profile?.display_name || "User"}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(currentMoment.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isOwn && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="min-h-[400px] flex items-center justify-center p-4 pt-20 pb-16">
          {currentMoment.media_url && currentMoment.media_type === "image" ? (
            <div className="relative w-full">
              <img
                src={currentMoment.media_url}
                alt="Moment"
                className="w-full max-h-[60vh] object-contain rounded-lg"
              />
              {currentMoment.content && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 rounded-b-lg">
                  <p className="text-white text-sm">{currentMoment.content}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center p-8 bg-card rounded-xl max-w-sm">
              <p className="text-lg">{currentMoment.content}</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        {currentIndex > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 bg-background/50"
            onClick={goPrev}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
        )}
        {currentIndex < moments.length - 1 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 bg-background/50"
            onClick={goNext}
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        )}

        {/* Tap areas for navigation */}
        <div
          className="absolute left-0 top-20 bottom-16 w-1/3 cursor-pointer"
          onClick={goPrev}
        />
        <div
          className="absolute right-0 top-20 bottom-16 w-1/3 cursor-pointer"
          onClick={goNext}
        />
      </DialogContent>
    </Dialog>
  );
};
