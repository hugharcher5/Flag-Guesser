import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const friendshipId = typeof body?.friendshipId === 'string' ? body.friendshipId.trim() : '';
  if (!friendshipId) {
    return NextResponse.json({ error: 'friendshipId is required' }, { status: 400 });
  }

  const { data: row } = await supabase
    .from('friends')
    .select('id, requester_id, addressee_id')
    .eq('id', friendshipId)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ error: 'Friendship not found' }, { status: 404 });
  }
  if (row.requester_id !== user.id && row.addressee_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error: deleteErr } = await supabase
    .from('friends')
    .delete()
    .eq('id', friendshipId);

  if (deleteErr) {
    console.error('friends remove error:', deleteErr.message);
    return NextResponse.json({ error: 'Failed to remove friend' }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
