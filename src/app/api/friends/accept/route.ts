export const dynamic = 'force-dynamic';

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

  // RLS ensures only the addressee can update; also verify the row exists and user is addressee
  const { data: row } = await supabase
    .from('friends')
    .select('id, addressee_id, status')
    .eq('id', friendshipId)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }
  if (row.addressee_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (row.status !== 'pending') {
    return NextResponse.json({ error: 'Request is not pending' }, { status: 400 });
  }

  const { error: updateErr } = await supabase
    .from('friends')
    .update({ status: 'accepted', updated_at: new Date().toISOString() })
    .eq('id', friendshipId);

  if (updateErr) {
    console.error('friends accept error:', updateErr.message);
    return NextResponse.json({ error: 'Failed to accept request' }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
