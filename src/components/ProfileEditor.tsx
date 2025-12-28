import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Upload, User, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Camera as CapacitorCamera } from '@capacitor/camera';
import { CameraResultType, CameraSource } from '@capacitor/camera';
import { NotificationSettings } from "./NotificationSettings";
import { DoNotDisturbSettings } from "./DoNotDisturbSettings";
import { LanguageSettings } from "./LanguageSettings";

export const ProfileEditor = () => {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState({
    display_name: "",
    status: "",
    avatar_url: "",
    username: ""
  });
  const { toast } = useToast();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, status, avatar_url, username')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      if (data) {
        setProfile({
          display_name: data.display_name || "",
          status: data.status || "",
          avatar_url: data.avatar_url || "",
          username: data.username || ""
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const handleImageUpload = async (source: 'camera' | 'gallery') => {
    try {
      setUploading(true);
      
      const image = await CapacitorCamera.getPhoto({
        quality: 80,
        allowEditing: true,
        resultType: CameraResultType.DataUrl,
        source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
        width: 500,
        height: 500
      });

      if (!image.dataUrl) {
        throw new Error('No image data received');
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Convert data URL to blob
      const response = await fetch(image.dataUrl);
      const blob = await response.blob();
      
      const fileName = `${Date.now()}.${image.format}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, {
          contentType: `image/${image.format}`,
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setProfile(prev => ({ ...prev, avatar_url: publicUrl }));

      toast({
        title: "Image uploaded",
        description: "Your profile picture has been updated"
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: profile.display_name.trim(),
          status: profile.status.trim(),
          avatar_url: profile.avatar_url
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Profile updated",
        description: "Your profile has been saved successfully"
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Update failed",
        description: "Failed to update profile. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
      <div className="text-center space-y-2 sm:space-y-4">
        <h2 className="text-xl sm:text-2xl font-bold">Edit Profile</h2>
        <p className="text-sm sm:text-base text-muted-foreground">Update your profile picture and status</p>
      </div>

      {/* Avatar Section */}
      <div className="flex flex-col items-center gap-3 sm:gap-4 p-4 sm:p-6 bg-card rounded-lg border border-border">
        <Avatar className="w-24 h-24 sm:w-32 sm:h-32">
          <AvatarImage src={profile.avatar_url} />
          <AvatarFallback className="bg-primary text-primary-foreground text-2xl sm:text-3xl">
            {profile.display_name ? profile.display_name[0].toUpperCase() : <User className="w-8 h-8 sm:w-12 sm:h-12" />}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleImageUpload('camera')}
            disabled={uploading}
            className="text-xs sm:text-sm"
          >
            {uploading ? (
              <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 animate-spin" />
            ) : (
              <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
            )}
            Camera
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleImageUpload('gallery')}
            disabled={uploading}
            className="text-xs sm:text-sm"
          >
            <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
            Gallery
          </Button>
        </div>
      </div>

      {/* Profile Details */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={profile.username}
            disabled
            className="bg-muted"
          />
          <p className="text-xs text-muted-foreground">Username cannot be changed</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="display_name">Display Name</Label>
          <Input
            id="display_name"
            value={profile.display_name}
            onChange={(e) => setProfile(prev => ({ ...prev, display_name: e.target.value }))}
            placeholder="Enter your display name"
            maxLength={50}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Textarea
            id="status"
            value={profile.status}
            onChange={(e) => setProfile(prev => ({ ...prev, status: e.target.value }))}
            placeholder="What's on your mind?"
            maxLength={150}
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            {profile.status.length}/150 characters
          </p>
        </div>
      </div>

      <Button
        onClick={handleSave}
        disabled={loading}
        className="w-full"
        size="lg"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Saving...
          </>
        ) : (
          "Save Profile"
        )}
      </Button>

      {/* Language Settings */}
      <LanguageSettings />

      {/* Notification Settings */}
      <NotificationSettings />

      {/* Do Not Disturb Settings */}
      <DoNotDisturbSettings />
    </div>
  );
};
