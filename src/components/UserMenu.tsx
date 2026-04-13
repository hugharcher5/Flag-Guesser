'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export type FriendStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'self';

interface UserMenuProps {
  username: string;
  friendStatus: FriendStatus;
  onFriendAdded?: () => void;
}

export default function UserMenu({ username, friendStatus, onFriendAdded }: UserMenuProps) {
  if (friendStatus === 'self') return null;

  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [addState, setAddState] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  async function handleAddFriend(e: React.MouseEvent) {
    e.stopPropagation();
    if (addState !== 'idle') return;
    setAddState('loading');
    const res = await fetch('/api/friends/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    if (res.ok) {
      setAddState('sent');
      onFriendAdded?.();
      setTimeout(() => setOpen(false), 1500);
    } else {
      setAddState('error');
      setTimeout(() => setAddState('idle'), 2000);
    }
  }

  // The effective friend status, accounting for a just-sent request
  const effectiveStatus: FriendStatus = addState === 'sent' ? 'pending_sent' : friendStatus;

  return (
    <div ref={menuRef} className="relative inline-flex">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="p-1.5 rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
        aria-label="User options"
      >
        {/* Three vertical dots */}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
          <circle cx="7" cy="2.5" r="1.25" />
          <circle cx="7" cy="7" r="1.25" />
          <circle cx="7" cy="11.5" r="1.25" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[160px] overflow-hidden">

          {/* Friend action row */}
          {effectiveStatus === 'none' && (
            <button
              onClick={handleAddFriend}
              disabled={addState === 'loading'}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {addState === 'loading' ? 'Sending…' : addState === 'error' ? 'Failed — retry' : 'Add Friend'}
            </button>
          )}
          {effectiveStatus === 'pending_sent' && (
            <div className="px-4 py-2 text-sm text-gray-400 cursor-default">Request Sent</div>
          )}
          {effectiveStatus === 'pending_received' && (
            <div className="px-4 py-2 text-sm text-gray-400 cursor-default">Received Request</div>
          )}
          {effectiveStatus === 'accepted' && (
            <div className="px-4 py-2 text-sm text-gray-400 cursor-default">Friends ✓</div>
          )}

          <div className="border-t border-gray-100" />

          {/* View Profile */}
          <button
            onClick={(e) => { e.stopPropagation(); router.push(`/profile/${username}`); setOpen(false); }}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            View Profile
          </button>
        </div>
      )}
    </div>
  );
}
