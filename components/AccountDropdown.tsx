'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import DefaultAvatar from '@/components/DefaultAvatar';
import type { UserProfile } from '@/lib/services/profileService';

export default function AccountDropdown({
  user,
  profile,
  onProfileOpen,
  onBookingsOpen,
  onMotionAdminOpen,
  onVenueAdminOpen,
}: {
  user: any;
  profile?: UserProfile | null;
  onProfileOpen: () => void;
  onBookingsOpen: () => void;
  onMotionAdminOpen: () => void;
  onVenueAdminOpen: () => void;
}) {
  const [open, setOpen] = useState(false);

  const meta = user?.user_metadata || {};
  const displayName =
    profile?.display_name ||
    profile?.full_name ||
    meta.full_name ||
    user.email?.split('@')[0] ||
    'User';
  const avatarUrl = profile?.avatar_url || '';

  const isMotionAdmin =
    user?.email &&
    [
      'darylhsu45@gmail.com',
      'mingtan0403@gmail.com',
      'motionsportsapp@gmail.com',
      'kvorakijkamjorn@gmail.com',
    ].includes(user.email.toLowerCase());

  const isApprovedVenue =
    isMotionAdmin ||
    meta.role === 'venue_owner' ||
    meta.is_approved_venue === true;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Account menu"
        title={displayName}
        className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center overflow-hidden rounded-full border border-black/15 dark:border-white/15 bg-[#9E9E9E] transition hover:scale-105"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="h-full w-full object-cover"
          />
        ) : (
          <DefaultAvatar />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-56 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#16171A] p-2 shadow-xl animate-in fade-in zoom-in-95">
            <div className="border-b border-black/10 dark:border-white/10 px-3 py-2">
              <p className="truncate text-xs font-black text-[#101310] dark:text-[#F7F8F4]">
                {displayName}
              </p>
              <p className="truncate text-[10px] text-black/45 dark:text-[#F7F8F4]/50">
                {user.email}
              </p>
            </div>

            <div className="py-1 space-y-0.5">
              <button
                onClick={() => {
                  onProfileOpen();
                  setOpen(false);
                }}
                className="w-full rounded-xl px-3 py-2 text-left text-xs font-bold text-[#101310] dark:text-[#F7F8F4] hover:bg-[#f7f8f4] dark:hover:bg-white/10"
              >
                👤 My Profile
              </button>

              <button
                onClick={() => {
                  onBookingsOpen();
                  setOpen(false);
                }}
                className="w-full rounded-xl px-3 py-2 text-left text-xs font-bold text-[#101310] dark:text-[#F7F8F4] hover:bg-[#f7f8f4] dark:hover:bg-white/10"
              >
                📋 My Bookings
              </button>

              {isMotionAdmin && (
                <button
                  onClick={() => {
                    onMotionAdminOpen();
                    setOpen(false);
                  }}
                  className="w-full rounded-xl px-3 py-2 text-left text-xs font-black text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-500/15 hover:bg-purple-100 dark:hover:bg-purple-500/25"
                >
                  🛡️ Motion Approval Center
                </button>
              )}

              {isApprovedVenue && (
                <button
                  onClick={() => {
                    onVenueAdminOpen();
                    setOpen(false);
                  }}
                  className="w-full rounded-xl px-3 py-2 text-left text-xs font-bold text-[#5e7310] dark:text-[#d8ff3e] bg-[#eef7cf]/60 dark:bg-[#d8ff3e]/15 hover:bg-[#eef7cf] dark:hover:bg-[#d8ff3e]/25"
                >
                  🏟️ Venue Control Centre
                </button>
              )}
            </div>

            <div className="border-t border-black/10 dark:border-white/10 pt-1">
              <button
                onClick={() => {
                  supabase.auth.signOut();
                  setOpen(false);
                }}
                className="w-full rounded-xl px-3 py-2 text-left text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
              >
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}