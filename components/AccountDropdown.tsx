'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function AccountDropdown({
  user,
  onBookingsOpen,
  onVenueAdminOpen,
}: {
  user: any;
  onBookingsOpen: () => void;
  onVenueAdminOpen: () => void;
}) {
  const [open, setOpen] = useState(false);

  const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
  const initial = displayName[0].toUpperCase();
  const isApprovedVenue =
    user.user_metadata?.role === 'venue_owner' || user.user_metadata?.is_approved_venue === true;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 sm:gap-2 rounded-full border border-black/15 bg-white px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs font-bold text-black transition hover:bg-black/5"
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-[#101310] text-[11px] font-black text-[#d8ff3e]">
          {initial}
        </span>
        <span className="max-w-[70px] sm:max-w-[100px] truncate">{displayName}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-56 rounded-2xl border border-black/10 bg-white p-2 shadow-xl animate-in fade-in zoom-in-95">
            <div className="border-b border-black/10 px-3 py-2">
              <p className="truncate text-xs font-black text-black">{displayName}</p>
              <p className="truncate text-[10px] text-black/45">{user.email}</p>
            </div>

            <div className="py-1">
              <button
                onClick={() => {
                  onBookingsOpen();
                  setOpen(false);
                }}
                className="w-full rounded-xl px-3 py-2 text-left text-xs font-bold text-black hover:bg-[#f7f8f4]"
              >
                📋 My Bookings
              </button>

              {isApprovedVenue ? (
                <button
                  onClick={() => {
                    onVenueAdminOpen();
                    setOpen(false);
                  }}
                  className="w-full rounded-xl px-3 py-2 text-left text-xs font-bold text-[#5e7310] bg-[#eef7cf]/60 hover:bg-[#eef7cf]"
                >
                  🏟️ Venue Control Centre
                </button>
              ) : (
                <button
                  onClick={() => {
                    onVenueAdminOpen();
                    setOpen(false);
                  }}
                  className="w-full rounded-xl px-3 py-2 text-left text-xs font-bold text-black/40 hover:bg-gray-50"
                >
                  🔒 Venue Control (Request Access)
                </button>
              )}
            </div>

            <div className="border-t border-black/10 pt-1">
              <button
                onClick={() => {
                  supabase.auth.signOut();
                  setOpen(false);
                }}
                className="w-full rounded-xl px-3 py-2 text-left text-xs font-bold text-red-600 hover:bg-red-50"
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