'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';

export type FriendStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'self';

interface FriendStatusData {
  statusMap: Map<string, FriendStatus>;
  currentUsername: string | null;
  loading: boolean;
  refresh: () => void;
}

export function useFriendStatuses(): FriendStatusData {
  const [statusMap, setStatusMap] = useState<Map<string, FriendStatus>>(new Map());
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .maybeSingle();

      if (!cancelled) setCurrentUsername(profile?.username ?? null);

      const [listRes, pendingRes, sentRes] = await Promise.all([
        fetch('/api/friends/list'),
        fetch('/api/friends/pending'),
        fetch('/api/friends/sent'),
      ]);

      const [listData, pendingData, sentData] = await Promise.all([
        listRes.ok ? listRes.json() : { friends: [] },
        pendingRes.ok ? pendingRes.json() : { requests: [] },
        sentRes.ok ? sentRes.json() : { requests: [] },
      ]);

      if (cancelled) return;

      const map = new Map<string, FriendStatus>();
      for (const f of (listData.friends ?? [])) map.set(f.username, 'accepted');
      for (const r of (pendingData.requests ?? [])) map.set(r.username, 'pending_received');
      for (const r of (sentData.requests ?? [])) map.set(r.username, 'pending_sent');

      setStatusMap(map);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [tick]);

  return { statusMap, currentUsername, loading, refresh };
}
