export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createSupabaseServer();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Pending requests sent TO the current user
  const { data: requests, error: reqErr } = await supabase
    .from('friends')
    .select('id, requester_id, created_at')
    .eq('addressee_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (reqErr) {
    console.error('friends pending error:', reqErr.message);
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
  }

  if (!requests || requests.length === 0) {
    return NextResponse.json({ requests: [] }, { status: 200 });
  }

  const requesterIds = requests.map((r) => r.requester_id);

  const { data: profiles, error: profileErr } = await supabase
    .from('profiles')
    .select('id, username, country')
    .in('id', requesterIds);

  if (profileErr) {
    console.error('friends pending profile fetch error:', profileErr.message);
    return NextResponse.json({ error: 'Failed to fetch requester profiles' }, { status: 500 });
  }

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const result = requests.map((r) => {
    const profile = profileMap.get(r.requester_id);
    return {
      friendshipId: r.id,
      userId: r.requester_id,
      username: profile?.username ?? 'Unknown',
      country: profile?.country ?? null,
      created_at: r.created_at,
    };
  });

  return NextResponse.json({ requests: result }, { status: 200 });
}
