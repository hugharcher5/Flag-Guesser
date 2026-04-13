'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import countries from '@/data/countries';

type Tab = 'friends' | 'received' | 'sent';

interface Friend {
  friendshipId: string;
  userId: string;
  username: string;
  country: string | null;
}

interface PendingRequest {
  friendshipId: string;
  userId: string;
  username: string;
  country: string | null;
  created_at: string;
}

function getCountryCode(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length === 2 && /^[A-Za-z]{2}$/.test(value)) return value.toUpperCase();
  const country = countries.find((c) => c.name === value);
  return country?.code ?? null;
}

function FlagImg({ country, size = 20 }: { country: string | null; size?: number }) {
  const code = getCountryCode(country);
  if (!code) return null;
  return (
    <img
      src={`https://flagcdn.com/w40/${code.toLowerCase()}.png`}
      alt={country ?? ''}
      className="rounded-sm object-contain shrink-0"
      style={{ width: size * 1.4, height: size }}
    />
  );
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

export default function FriendsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('friends');

  const [friends, setFriends] = useState<Friend[]>([]);
  const [received, setReceived] = useState<PendingRequest[]>([]);
  const [sent, setSent] = useState<PendingRequest[]>([]);

  const [addUsername, setAddUsername] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addMsg, setAddMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const addMsgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  interface SearchResult { username: string; country: string | null; }
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Auth guard + initial load
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace('/');
        return;
      }
      loadAll().finally(() => setLoading(false));
    });
  }, [router]);

  async function loadAll() {
    const [listRes, pendingRes, sentRes] = await Promise.all([
      fetch('/api/friends/list'),
      fetch('/api/friends/pending'),
      fetch('/api/friends/sent'),
    ]);
    const [listData, pendingData, sentData] = await Promise.all([
      listRes.json(),
      pendingRes.json(),
      sentRes.json(),
    ]);
    setFriends(listData.friends ?? []);
    setReceived(pendingData.requests ?? []);
    setSent(sentData.requests ?? []);
  }

  // Debounced username search
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    const q = addUsername.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setNoResults(false);
      setShowSuggestions(false);
      return;
    }
    searchDebounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/friends/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) return;
      const data = await res.json();
      const results: SearchResult[] = data.results ?? [];
      setSuggestions(results);
      setNoResults(results.length === 0);
      setShowSuggestions(true);
    }, 300);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [addUsername]);

  function showAddMsg(type: 'success' | 'error', text: string) {
    setAddMsg({ type, text });
    if (addMsgTimerRef.current) clearTimeout(addMsgTimerRef.current);
    addMsgTimerRef.current = setTimeout(() => setAddMsg(null), 4000);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const username = addUsername.trim();
    if (!username || addLoading) return;
    setAddLoading(true);
    const res = await fetch('/api/friends/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    const body = await res.json().catch(() => ({}));
    setAddLoading(false);
    if (res.ok) {
      setAddUsername('');
      setSuggestions([]);
      setShowSuggestions(false);
      showAddMsg('success', `Friend request sent to ${username}!`);
      // Reload sent list
      fetch('/api/friends/sent').then((r) => r.json()).then((d) => setSent(d.requests ?? []));
    } else {
      showAddMsg('error', body.error ?? 'Something went wrong.');
    }
  }

  async function handleAccept(friendshipId: string) {
    setActionLoading(friendshipId);
    const res = await fetch('/api/friends/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendshipId }),
    });
    setActionLoading(null);
    if (res.ok) {
      await loadAll();
    }
  }

  async function handleReject(friendshipId: string) {
    setActionLoading(friendshipId);
    const res = await fetch('/api/friends/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendshipId }),
    });
    setActionLoading(null);
    if (res.ok) {
      setReceived((prev) => prev.filter((r) => r.friendshipId !== friendshipId));
    }
  }

  async function handleRemove(friendshipId: string) {
    setActionLoading(friendshipId);
    const res = await fetch('/api/friends/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendshipId }),
    });
    setActionLoading(null);
    if (res.ok) {
      setFriends((prev) => prev.filter((f) => f.friendshipId !== friendshipId));
    }
  }

  async function handleCancel(friendshipId: string) {
    setActionLoading(friendshipId);
    const res = await fetch('/api/friends/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendshipId }),
    });
    setActionLoading(null);
    if (res.ok) {
      setSent((prev) => prev.filter((r) => r.friendshipId !== friendshipId));
    }
  }

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-8 flex flex-col gap-5 animate-pulse">
          <div className="h-7 w-32 bg-gray-100 rounded" />
          <div className="h-10 bg-gray-100 rounded-xl" />
          <div className="h-40 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md flex flex-col gap-4">

        {/* Back link */}
        <a
          href="/"
          className="self-start text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
        >
          ← Back to games
        </a>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-8 flex flex-col gap-6">

          {/* Header */}
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold text-gray-800">Friends</h1>
            <p className="text-sm text-gray-500">
              {friends.length === 0 ? 'No friends yet' : `${friends.length} friend${friends.length === 1 ? '' : 's'}`}
            </p>
          </div>

          {/* Add Friend */}
          <form onSubmit={handleAdd} className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">Add Friend</label>
            <div className="flex gap-2 relative">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Username"
                  value={addUsername}
                  onChange={(e) => setAddUsername(e.target.value)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  onFocus={() => { if (suggestions.length > 0 || noResults) setShowSuggestions(true); }}
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={20}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                />
                {showSuggestions && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-10 bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden">
                    {suggestions.length > 0 ? (
                      suggestions.map((s) => {
                        const code = getCountryCode(s.country);
                        return (
                          <div
                            key={s.username}
                            onMouseDown={() => {
                              setAddUsername(s.username);
                              setShowSuggestions(false);
                            }}
                            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm text-gray-800"
                          >
                            {code && (
                              <img
                                src={`https://flagcdn.com/w40/${code.toLowerCase()}.png`}
                                alt={s.country ?? ''}
                                className="w-5 h-auto rounded-sm object-contain shrink-0"
                              />
                            )}
                            <span className="font-medium">{s.username}</span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="px-3 py-2 text-sm text-gray-400">No users found</div>
                    )}
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={!addUsername.trim() || addLoading}
                className="px-4 py-2 rounded-lg bg-gray-800 text-white text-sm font-semibold hover:bg-gray-900 active:bg-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {addLoading ? '…' : 'Add'}
              </button>
            </div>
            {addMsg && (
              <p className={`text-xs font-medium ${addMsg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {addMsg.text}
              </p>
            )}
          </form>

          {/* Tabs */}
          <div className="flex border-b border-gray-100">
            {([
              { key: 'friends' as Tab, label: 'Friends' },
              { key: 'received' as Tab, label: received.length > 0 ? `Received (${received.length})` : 'Received' },
              { key: 'sent' as Tab, label: 'Sent' },
            ] as { key: Tab; label: string }[]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                  tab === key
                    ? 'border-b-2 border-blue-600 text-blue-600 -mb-px'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Friends tab */}
          {tab === 'friends' && (
            <div className="flex flex-col gap-0 -mx-1">
              {friends.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">
                  No friends yet. Send a request above!
                </p>
              ) : (
                friends.map((f) => (
                  <div
                    key={f.friendshipId}
                    className="flex items-center gap-3 px-1 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <FlagImg country={f.country} />
                    <span className="flex-1 text-sm font-semibold text-gray-800 truncate">
                      {f.username}
                    </span>
                    <button
                      onClick={() => handleRemove(f.friendshipId)}
                      disabled={actionLoading === f.friendshipId}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40"
                    >
                      {actionLoading === f.friendshipId ? '…' : 'Remove'}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Received tab */}
          {tab === 'received' && (
            <div className="flex flex-col gap-0 -mx-1">
              {received.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No pending requests.</p>
              ) : (
                received.map((r) => (
                  <div
                    key={r.friendshipId}
                    className="flex items-center gap-3 px-1 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <FlagImg country={r.country} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{r.username}</p>
                      <p className="text-xs text-gray-400">{timeAgo(r.created_at)}</p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => handleAccept(r.friendshipId)}
                        disabled={actionLoading === r.friendshipId}
                        className="px-3 py-1 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors disabled:opacity-40"
                      >
                        {actionLoading === r.friendshipId ? '…' : 'Accept'}
                      </button>
                      <button
                        onClick={() => handleReject(r.friendshipId)}
                        disabled={actionLoading === r.friendshipId}
                        className="px-3 py-1 rounded-md border border-gray-200 text-gray-600 text-xs font-semibold hover:border-gray-300 transition-colors disabled:opacity-40"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Sent tab */}
          {tab === 'sent' && (
            <div className="flex flex-col gap-0 -mx-1">
              {sent.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No pending requests.</p>
              ) : (
                sent.map((r) => (
                  <div
                    key={r.friendshipId}
                    className="flex items-center gap-3 px-1 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <FlagImg country={r.country} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{r.username}</p>
                      <p className="text-xs text-gray-400">{timeAgo(r.created_at)}</p>
                    </div>
                    <button
                      onClick={() => handleCancel(r.friendshipId)}
                      disabled={actionLoading === r.friendshipId}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40 shrink-0"
                    >
                      {actionLoading === r.friendshipId ? '…' : 'Cancel'}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
