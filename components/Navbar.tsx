'use client';

import { useState } from 'react';
import { Menu, X, Zap } from 'lucide-react';
import AccountDropdown from '@/components/AccountDropdown';
import { supabase } from '@/lib/supabase';

export default function Navbar({
  user,
  onNavigate,
  onBookingsOpen,
  onVenueAdminOpen,
  onMotionAdminOpen,
  onAuthModalOpen,
}: {
  user: any;
  onNavigate: (targetId?: string) => void;
  onBookingsOpen: () => void;
  onVenueAdminOpen: () => void;
  onMotionAdminOpen: () => void;
  onAuthModalOpen: () => void;
}) {
  const [mobileMenu, setMobileMenu] = useState(false);

  return (
    <header className="relative z-20 border-b border-black/5 bg-[#f7f8f4]">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
        <button
          className="flex items-center gap-2"
          onClick={() => onNavigate()}
          aria-label="Motion home"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[#101310] text-[#d8ff3e]">
            <Zap size={21} fill="currentColor" strokeWidth={2.5} />
          </span>
          <span className="text-2xl font-black tracking-[-.08em]">
            motion<span className="text-[#7b941c]">.</span>
          </span>
        </button>

        <nav className="hidden items-center gap-8 text-sm font-semibold md:flex">
          <button onClick={() => onNavigate('explore')} className="hover:opacity-60 transition">
            Explore courts
          </button>
          <button onClick={() => onNavigate('how-it-works')} className="hover:opacity-60 transition">
            How it works
          </button>
          <button onClick={onVenueAdminOpen} className="hover:opacity-60 transition">
            Partners & Venues ↗
          </button>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <AccountDropdown
              user={user}
              onBookingsOpen={onBookingsOpen}
              onVenueAdminOpen={onVenueAdminOpen}
              onMotionAdminOpen={onMotionAdminOpen}
            />
          ) : (
            <button
              onClick={onAuthModalOpen}
              className="rounded-full bg-[#101310] px-3.5 py-1.5 sm:px-5 sm:py-2.5 text-xs font-bold text-white transition hover:bg-[#30372a]"
            >
              Sign in / Sign up
            </button>
          )}

          <button
            onClick={() => onNavigate('explore')}
            className="hidden sm:flex rounded-full bg-[#d8ff3e] px-5 py-2.5 text-sm font-bold text-black transition hover:bg-[#c9f02e]"
          >
            Find a court
          </button>

          <button
            className="md:hidden ml-1 p-1 text-black"
            onClick={() => setMobileMenu(!mobileMenu)}
            aria-label="Toggle menu"
          >
            {mobileMenu ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {mobileMenu && (
        <div className="border-t border-black/10 px-5 py-4 md:hidden bg-white shadow-lg space-y-3">
          <button
            className="block w-full text-left py-2 font-semibold text-sm"
            onClick={() => {
              onNavigate('explore');
              setMobileMenu(false);
            }}
          >
            Explore courts
          </button>
          <button
            className="block w-full text-left py-2 font-semibold text-sm"
            onClick={() => {
              onNavigate('how-it-works');
              setMobileMenu(false);
            }}
          >
            How it works
          </button>
          <button
            className="block w-full text-left py-2 font-semibold text-sm"
            onClick={() => {
              onVenueAdminOpen();
              setMobileMenu(false);
            }}
          >
            Partners & Venues ↗
          </button>

          <div className="border-t border-black/10 pt-3">
            {user ? (
              <div className="space-y-2">
                <button
                  onClick={() => {
                    onBookingsOpen();
                    setMobileMenu(false);
                  }}
                  className="w-full rounded-xl bg-[#f7f8f4] py-2.5 text-center text-xs font-bold text-black"
                >
                  📋 My Bookings
                </button>
                <button
                  onClick={() => {
                    onVenueAdminOpen();
                    setMobileMenu(false);
                  }}
                  className="w-full rounded-xl bg-[#eef7cf] py-2.5 text-center text-xs font-bold text-[#5e7310]"
                >
                  🏟️ Venue Control Centre
                </button>
                <button
                  onClick={() => {
                    supabase.auth.signOut();
                    setMobileMenu(false);
                  }}
                  className="w-full rounded-xl border border-red-200 bg-red-50 py-2.5 text-center text-xs font-bold text-red-600"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  onAuthModalOpen();
                  setMobileMenu(false);
                }}
                className="w-full rounded-full bg-[#101310] py-2.5 text-center text-xs font-bold text-white"
              >
                Sign In / Sign Up
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}