import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const username = typeof body?.username === 'string' ? body.username.trim() : '';
  if (!username) {
    return NextResponse.json({ error: 'username is required' }, { status: 400 });
  }

  // Look up target user by username
  const { data: target, error: targetErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();

  if (targetErr) {
    return NextResponse.json({ error: 'Failed to look up user' }, { status: 500 });
  }
  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  if (target.id === user.id) {
    return NextResponse.json({ error: 'You cannot add yourself' }, { status: 400 });
  }

  // Check for existing friendship in either direction
  const { data: existing } = await supabase
    .from('friends')
    .select('id, status')
    .or(
      `and(requester_id.eq.${user.id},addressee_id.eq.${target.id}),` +
      `and(requester_id.eq.${target.id},addressee_id.eq.${user.id})`
    )
    .maybeSingle();

  if (existing) {
    if (existing.status === 'accepted') {
      return NextResponse.json({ error: 'Already friends' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Friend request already pending' }, { status: 409 });
  }

  // Insert friend request
  const { error: insertErr } = await supabase
    .from('friends')
    .insert({ requester_id: user.id, addressee_id: target.id, status: 'pending' });

  if (insertErr) {
    if (insertErr.code === '23505') {
      return NextResponse.json({ error: 'Friend request already exists' }, { status: 409 });
    }
    console.error('friends insert error:', insertErr.message);
    return NextResponse.json({ error: 'Failed to send request' }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
