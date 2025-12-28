import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Community {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  member_count: number;
  is_public: boolean;
  created_by: string;
  created_at: string;
}

interface CommunityMembership {
  community_id: string;
  role: string;
  joined_at: string;
  community: Community;
}

export const useCommunities = () => {
  const [memberships, setMemberships] = useState<CommunityMembership[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  const fetchMemberships = useCallback(async () => {
    if (!user) {
      setMemberships([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // First get member records
      const { data: memberData, error: memberError } = await supabase
        .from('community_members')
        .select('community_id, role, joined_at')
        .eq('user_id', user.id);

      if (memberError) throw memberError;

      if (!memberData || memberData.length === 0) {
        setMemberships([]);
        setIsLoading(false);
        return;
      }

      // Then fetch the communities
      const communityIds = memberData.map(m => m.community_id);
      const { data: communityData, error: communityError } = await supabase
        .from('communities')
        .select('*')
        .in('id', communityIds);

      if (communityError) throw communityError;

      // Combine the data
      const communityMap = new Map(communityData?.map(c => [c.id, c]) || []);
      const combined = memberData
        .map(m => ({
          ...m,
          community: communityMap.get(m.community_id)!
        }))
        .filter(m => m.community)
        .sort((a, b) => new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime());

      setMemberships(combined);
    } catch (error) {
      console.error("Error fetching memberships:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const leaveCommunity = async (communityId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('community_members')
        .delete()
        .eq('community_id', communityId)
        .eq('user_id', user.id);

      if (error) throw error;

      setMemberships(prev => prev.filter(m => m.community_id !== communityId));
      return true;
    } catch (error) {
      console.error("Error leaving community:", error);
      return false;
    }
  };

  useEffect(() => {
    fetchMemberships();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('community-membership-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'community_members' },
        () => {
          fetchMemberships();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMemberships]);

  return {
    memberships,
    isLoading,
    refetch: fetchMemberships,
    leaveCommunity,
    joinedCommunityIds: new Set(memberships.map(m => m.community_id)),
  };
};
