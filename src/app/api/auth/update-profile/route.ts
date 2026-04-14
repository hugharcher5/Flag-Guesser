export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

interface UpdateProfileBody {
  username: string;
  country: string;
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: UpdateProfileBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { username, country } = body;

  if (typeof username !== 'string' || !USERNAME_RE.test(username.trim())) {
    return NextResponse.json(
      { error: 'Username must be 3–20 characters and contain only letters, numbers, and underscores.' },
      { status: 400 },
    );
  }

  if (typeof country !== 'string' || country.trim().length === 0) {
    return NextResponse.json({ error: 'Country is required.' }, { status: 400 });
  }

  const trimmedUsername = username.trim();

  // Check uniqueness — exclude the current user so they can keep their existing username
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', trimmedUsername)
    .neq('id', user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'Username already taken.' }, { status: 409 });
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ username: trimmedUsername, country: country.trim() })
    .eq('id', user.id);

  if (updateError) {
    console.error('update-profile error:', updateError.message);
    return NextResponse.json({ error: 'Failed to update profile.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
