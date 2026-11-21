'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function AccountDropdown({
  user,
  onBookingsOpen,
  onMotionAdminOpen,
  onVenueAdminOpen,
}: {
  user: any;
  onBookingsOpen: () => void;
  onMotionAdminOpen: () => void;
  onVenueAdminOpen: () => void;
}) {
  const [open, setOpen] = useState(false);

  const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
  const initial = displayName[0].toUpperCase();

  // Check if account is a Super Admin
  const isMotionAdmin =
    user?.email &&
    [
      'mingtan0403@gmail.com',
      'motionsportsapp@gmail.com',
      'kvorakijkamjorn@gmail.com'
    ].includes(user.email.toLowerCase());

  // Show Venue Control if user is approved venue owner OR super admin
  const isApprovedVenue =
    isMotionAdmin ||
    user?.user_metadata?.role === 'venue_owner' ||
    user?.user_metadata?.is_approved_venue === true;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 sm:gap-2 rounded-full border border-black/15 dark:border-white/10 bg-white dark:bg-[#0B0B0C] px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs font-bold text-[#101310] dark:text-[#F7F8F4] transition hover:bg-black/5 dark:hover:bg-white/10"
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-[#101310] dark:bg-[#d8ff3e] text-[11px] font-black text-[#d8ff3e] dark:text-[#101310]">
          {initial}
        </span>
        <span className="max-w-[70px] sm:max-w-[100px] truncate">{displayName}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-56 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#16171A] p-2 shadow-xl animate-in fade-in zoom-in-95">
            <div className="border-b border-black/10 dark:border-white/10 px-3 py-2">
              <p className="truncate text-xs font-black text-[#101310] dark:text-[#F7F8F4]">{displayName}</p>
              <p className="truncate text-[10px] text-black/45 dark:text-[#F7F8F4]/50">{user.email}</p>
            </div>

            <div className="py-1 space-y-0.5">
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

              {/* ONLY SHOWN IF APPROVED OR SUPER ADMIN */}
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
