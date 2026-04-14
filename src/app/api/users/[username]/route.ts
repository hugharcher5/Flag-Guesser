export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const supabase = await createSupabaseServer();

  // Get current viewer (optional — works unauthenticated)
  const { data: { user } } = await supabase.auth.getUser();

  // Look up the target profile (case-insensitive)
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, username, country, best_score, total_points, total_games, games_by_mode')
    .ilike('username', username)
    .maybeSingle();

  if (error) {
    console.error('profile fetch error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
  if (!profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Friendship status
  type FriendStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'self';
  let friendStatus: FriendStatus = 'none';
  let friendshipId: string | null = null;

  if (user) {
    if (user.id === profile.id) {
      friendStatus = 'self';
    } else {
      const { data: friendship } = await supabase
        .from('friends')
        .select('id, requester_id, status')
        .or(
          `and(requester_id.eq.${user.id},addressee_id.eq.${profile.id}),` +
          `and(requester_id.eq.${profile.id},addressee_id.eq.${user.id})`,
        )
        .maybeSingle();

      if (friendship) {
        friendshipId = friendship.id;
        if (friendship.status === 'accepted') {
          friendStatus = 'accepted';
        } else if (friendship.requester_id === user.id) {
          friendStatus = 'pending_sent';
        } else {
          friendStatus = 'pending_received';
        }
      }
    }
  }

  return NextResponse.json({
    username: profile.username,
    country: profile.country ?? null,
    bestScore: profile.best_score ?? 0,
    totalPoints: profile.total_points ?? 0,
    totalGames: profile.total_games ?? 0,
    gamesByMode: profile.games_by_mode ?? {},
    friendStatus,
    friendshipId,
  });
}
