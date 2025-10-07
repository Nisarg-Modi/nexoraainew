import { Phone, PhoneOff, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface IncomingCallDialogProps {
  open: boolean;
  callerName: string;
  isVideo: boolean;
  onAccept: () => void;
  onReject: () => void;
}

export const IncomingCallDialog = ({
  open,
  callerName,
  isVideo,
  onAccept,
  onReject,
}: IncomingCallDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={(open) => !open && onReject()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isVideo ? (
              <Video className="w-5 h-5 text-primary" />
            ) : (
              <Phone className="w-5 h-5 text-primary" />
            )}
            Incoming {isVideo ? 'Video' : 'Voice'} Call
          </DialogTitle>
          <DialogDescription className="text-lg font-medium text-foreground mt-4">
            {callerName} is calling you...
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-4 mt-6">
          <Button
            size="lg"
            variant="destructive"
            onClick={onReject}
            className="rounded-full w-16 h-16"
          >
            <PhoneOff className="w-8 h-8" />
          </Button>

          <Button
            size="lg"
            onClick={onAccept}
            className="rounded-full w-16 h-16 bg-green-500 hover:bg-green-600"
          >
            <Phone className="w-8 h-8" />
          </Button>
        </div>

        <p className="text-sm text-center text-muted-foreground mt-4">
          Accept to join the call
        </p>
      </DialogContent>
    </Dialog>
  );
};
