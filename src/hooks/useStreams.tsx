import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Stream {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  follower_count: number;
  is_verified: boolean;
  created_by: string;
  created_at: string;
}

interface StreamWithFollowing extends Stream {
  isFollowing: boolean;
  isOwner: boolean;
}

export const useStreams = () => {
  const [followedStreams, setFollowedStreams] = useState<StreamWithFollowing[]>([]);
  const [allStreams, setAllStreams] = useState<StreamWithFollowing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  const fetchStreams = useCallback(async () => {
    if (!user) {
      setFollowedStreams([]);
      setAllStreams([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Fetch all streams
      const { data: streams, error: streamsError } = await supabase
        .from('streams')
        .select('*')
        .order('follower_count', { ascending: false });

      if (streamsError) throw streamsError;

      // Fetch user's followed streams
      const { data: following, error: followingError } = await supabase
        .from('stream_followers')
        .select('stream_id')
        .eq('user_id', user.id);

      if (followingError) throw followingError;

      const followingIds = new Set(following?.map(f => f.stream_id) || []);

      const streamsWithStatus = (streams || []).map(stream => ({
        ...stream,
        isFollowing: followingIds.has(stream.id),
        isOwner: stream.created_by === user.id,
      }));

      setFollowedStreams(streamsWithStatus.filter(s => s.isFollowing || s.isOwner));
      setAllStreams(streamsWithStatus);
    } catch (error) {
      console.error("Error fetching streams:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const followStream = async (streamId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('stream_followers')
        .insert({
          stream_id: streamId,
          user_id: user.id,
        });

      if (error) throw error;

      // Update local state
      setAllStreams(prev => prev.map(s => 
        s.id === streamId 
          ? { ...s, isFollowing: true, follower_count: s.follower_count + 1 }
          : s
      ));
      
      setFollowedStreams(prev => {
        const stream = allStreams.find(s => s.id === streamId);
        if (stream) {
          return [...prev, { ...stream, isFollowing: true, follower_count: stream.follower_count + 1 }];
        }
        return prev;
      });

      return true;
    } catch (error) {
      console.error("Error following stream:", error);
      return false;
    }
  };

  const unfollowStream = async (streamId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('stream_followers')
        .delete()
        .eq('stream_id', streamId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update local state
      setAllStreams(prev => prev.map(s => 
        s.id === streamId 
          ? { ...s, isFollowing: false, follower_count: Math.max(0, s.follower_count - 1) }
          : s
      ));
      
      setFollowedStreams(prev => prev.filter(s => s.id !== streamId || s.isOwner));

      return true;
    } catch (error) {
      console.error("Error unfollowing stream:", error);
      return false;
    }
  };

  useEffect(() => {
    fetchStreams();

    const channel = supabase
      .channel('streams-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'streams' },
        () => {
          fetchStreams();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchStreams]);

  return {
    followedStreams,
    allStreams,
    isLoading,
    refetch: fetchStreams,
    followStream,
    unfollowStream,
    followedStreamIds: new Set(followedStreams.map(s => s.id)),
  };
};
