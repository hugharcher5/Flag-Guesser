export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = await createSupabaseServer();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') ?? '').trim();

  if (q.length < 2) {
    return NextResponse.json({ results: [] }, { status: 200 });
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('username, country')
    .ilike('username', `${q}%`)
    .neq('id', user.id)
    .limit(5);

  if (error) {
    console.error('friends search error:', error.message);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }

  return NextResponse.json({ results: data ?? [] }, { status: 200 });
}
