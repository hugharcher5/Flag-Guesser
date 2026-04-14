export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createSupabaseServer();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch all accepted friendships involving current user
  const { data: friendships, error: friendErr } = await supabase
    .from('friends')
    .select('id, requester_id, addressee_id')
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    .eq('status', 'accepted');

  if (friendErr) {
    console.error('friends list error:', friendErr.message);
    return NextResponse.json({ error: 'Failed to fetch friends' }, { status: 500 });
  }

  if (!friendships || friendships.length === 0) {
    return NextResponse.json({ friends: [] }, { status: 200 });
  }

  // Determine the other user's ID for each friendship
  const otherIds = friendships.map((f) =>
    f.requester_id === user.id ? f.addressee_id : f.requester_id
  );

  // Fetch profiles for those users
  const { data: profiles, error: profileErr } = await supabase
    .from('profiles')
    .select('id, username, country')
    .in('id', otherIds);

  if (profileErr) {
    console.error('friends profile fetch error:', profileErr.message);
    return NextResponse.json({ error: 'Failed to fetch friend profiles' }, { status: 500 });
  }

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const friends = friendships.map((f) => {
    const otherId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
    const profile = profileMap.get(otherId);
    return {
      friendshipId: f.id,
      userId: otherId,
      username: profile?.username ?? 'Unknown',
      country: profile?.country ?? null,
    };
  }).sort((a, b) => a.username.localeCompare(b.username));

  return NextResponse.json({ friends }, { status: 200 });
}
