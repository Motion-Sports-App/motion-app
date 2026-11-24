'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  ChevronDown,
  MapPin,
  Search,
  SlidersHorizontal,
  Sparkles,
  Zap,
  Check,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { venueService } from '@/lib/services/venueService';
import { bookingService, type Booking } from '@/lib/services/bookingService';
import { SPORTS_LIST, DEFAULT_VENUE_IMAGE } from '@/lib/constants';
import { useBrowserHistorySync } from '@/hooks/useBrowserHistoryState';
import type { Sport, Venue } from '@/lib/data';

import Navbar from '@/components/Navbar';
import AuthModal from '@/components/AuthModal';
import VenueCard from '@/components/VenueCard';
import VenueModal from '@/components/VenueModal';
import UserBookingsView from '@/components/UserBookingsView';
import Dashboard from '@/components/Dashboard';
import PartnerOnboardingView from '@/components/PartnerOnboardingView';
import MotionAdminCenter from '@/components/MotionAdminCenter';
import ProfileView from '@/components/ProfileView';
import { partnerService } from '@/lib/services/partnerService';

const money = (n?: number | null) => {
  const val = Number(n);
  return `฿${isNaN(val) ? 0 : val.toLocaleString('en-US')}`;
};
const today = new Date();
const dateLabel = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

type ActiveView =
  | 'home'
  | 'profile'
  | 'bookings'
  | 'venue-admin'
  | 'partner-onboarding'
  | 'motion-admin';

export default function Home() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSport, setActiveSport] = useState<Sport>('All sports');
  const [query, setQuery] = useState('');
  const [area, setArea] = useState('Anywhere in Bangkok');
  const [maxPrice, setMaxPrice] = useState('Any price');
  const [selected, setSelected] = useState<Venue | null>(null);
  const [selectedDate, setSelectedDate] = useState(dateLabel(today));
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [confirmed, setConfirmed] = useState<Booking | null>(null);

  // Unified View State synced with browser history
  const [activeView, setActiveView] = useState<ActiveView>('home');
  const [hasActiveCoach, setHasActiveCoach] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const venuesRef = useRef<Venue[]>([]);
  venuesRef.current = venues;

  const restoreVenueById = useCallback((venueId: string | null) => {
    if (!venueId) {
      setSelected(null);
      return;
    }
    const found = venuesRef.current.find((v) => String(v.id) === String(venueId));
    setSelected(found || null);
  }, []);

  const handleSetActiveView = useCallback((view: string) => {
    const validViews: ActiveView[] = [
      'home',
      'profile',
      'bookings',
      'venue-admin',
      'partner-onboarding',
      'motion-admin',
    ];
    setActiveView(
      validViews.includes(view as ActiveView) ? (view as ActiveView) : 'home'
    );
  }, []);

  const { navigateTo } = useBrowserHistorySync({
    activeView,
    setActiveView: handleSetActiveView,
    selectedVenueId: selected?.id || null,
    onRestoreVenueById: restoreVenueById,
  });

  // Restore initial view / venue from URL on initial load or refresh
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialView = params.get('view');
    if (initialView) {
      handleSetActiveView(initialView);
    }
  }, [handleSetActiveView]);

  const resetViews = (pushHistory = true) => {
    if (pushHistory) {
      navigateTo('home', null);
    } else {
      setActiveView('home');
      setSelected(null);
    }
  };

  const handleNavigate = (targetId?: string) => {
    if (activeView !== 'home' || selected) {
      navigateTo('home', null);
    }
    if (targetId) {
      setTimeout(() => {
        document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user?.email) {
      bookingService.getByUserEmail(user.email).then(setBookings);
    } else {
      setBookings([]);
    }
  }, [user]);

  useEffect(() => {
    if (user?.id) {
      partnerService.getUserApplicationStatuses(user.id).then(({ coachStatus }) => {
        setHasActiveCoach(coachStatus === 'approved');
      });
    } else {
      setHasActiveCoach(false);
    }
  }, [user]);

  const loadVenues = async () => {
    const data = await venueService.getAll();
    const safeData = (data || []).map((v) => ({
      ...v,
      facilities: v.facilities || [],
      slots: v.slots || [],
    }));
    setVenues(safeData);
    venuesRef.current = safeData;
    setLoading(false);

    // If URL had ?venue=<id> on initial page load, open that venue modal once venues are fetched
    const params = new URLSearchParams(window.location.search);
    const initialVenueId = params.get('venue');
    if (initialVenueId) {
      const found = safeData.find((v) => String(v.id) === String(initialVenueId));
      if (found) setSelected(found);
    }

    return safeData;
  };

  useEffect(() => {
    loadVenues();
  }, []);

  const handleCancelBooking = async (id: string) => {
    setBookings((old) => old.map((b) => (b.id === id ? { ...b, status: 'Cancelled' } : b)));
    await bookingService.cancel(id);
  };

  const handleResetFilters = () => {
    setActiveSport('All sports');
    setQuery('');
    setArea('Anywhere in Bangkok');
    setMaxPrice('Any price');
  };

  const hasActiveFilters =
    activeSport !== 'All sports' ||
    query.trim() !== '' ||
    area !== 'Anywhere in Bangkok' ||
    maxPrice !== 'Any price';

  const filtered = useMemo(() => {
    return venues.filter((v) => {
      const sportMatch = activeSport === 'All sports' || v.sport === activeSport;
      const q = query.trim().toLowerCase();

      const facilitiesList = Array.isArray(v.facilities) ? v.facilities.join(' ') : '';
      const queryMatch =
        !q || `${v.name || ''} ${v.sport || ''} ${v.area || ''} ${facilitiesList}`.toLowerCase().includes(q);
      const areaMatch =
        area === 'Anywhere in Bangkok' || (v.area && v.area.toLowerCase().includes(area.toLowerCase()));
      const priceMatch = maxPrice === 'Any price' || (v.price && v.price <= Number(maxPrice));

      return sportMatch && queryMatch && areaMatch && priceMatch;
    });
  }, [venues, activeSport, query, area, maxPrice]);

  const handleVenueAdminAccess = async () => {
    const latestVenues = await loadVenues();

    const isSuperAdmin =
      user?.email &&
      [
        'darylhsu45@gmail.com',
        'mingtan0403@gmail.com',
        'motionsportsapp@gmail.com',
        'kvorakijkamjorn@gmail.com',
      ].includes(user.email.toLowerCase());

    const userHasActiveVenue =
      Boolean(user?.id) &&
      latestVenues.some((v) => v.user_id === user.id || v.owner_id === user.id);

    let userHasActiveCoach = hasActiveCoach;
    if (user?.id) {
      const { coachStatus } = await partnerService.getUserApplicationStatuses(user.id);
      userHasActiveCoach = coachStatus === 'approved';
      setHasActiveCoach(userHasActiveCoach);
    }

    if (isSuperAdmin || userHasActiveVenue || userHasActiveCoach) {
      navigateTo('venue-admin', null);
    } else {
      navigateTo('partner-onboarding', null);
    }
  };

  const handleMotionAdminOpen = () => {
    navigateTo('motion-admin', null);
  };

  const handleProfileOpen = () => {
    navigateTo('profile', null);
  };

  const handleBookingsOpen = () => {
    if (user?.email) {
      bookingService.getByUserEmail(user.email).then(setBookings);
    }
    navigateTo('bookings', null);
  };

  const handleOpenVenueModal = (venue: Venue) => {
    navigateTo(activeView, venue.id);
  };

  const handleCloseVenueModal = () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('venue')) {
      window.history.back();
    } else {
      setSelected(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f8f4] text-[#101310] dark:bg-[#0B0B0C] dark:text-[#F7F8F4] transition-colors">
      {/* STICKY HEADER WRAPPER */}
      <div className="sticky top-0 z-40 bg-[#f7f8f4] dark:bg-[#16171A] transition-colors">
        <div className="bg-[#d8ff3e] text-[#101310] px-4 py-2 text-center text-[11px] font-extrabold uppercase tracking-[.18em] sm:text-xs">
          Your next game starts here <span className="mx-2">✳</span> Meet you on the court
        </div>

        <Navbar
          user={user}
          onNavigate={handleNavigate}
          onProfileOpen={handleProfileOpen}
          onBookingsOpen={handleBookingsOpen}
          onVenueAdminOpen={handleVenueAdminAccess}
          onMotionAdminOpen={handleMotionAdminOpen}
          onAuthModalOpen={() => setShowAuthModal(true)}
        />
      </div>

      {/* RENDER ACTIVE VIEW BASED ON SYNCED VIEW STATE */}
      {activeView === 'profile' && user ? (
        <ProfileView
          user={user}
          onUserUpdated={(updatedUser) => setUser(updatedUser)}
        />
      ) : activeView === 'motion-admin' ? (
        <MotionAdminCenter
          user={user}
          onBack={() => resetViews(true)}
          onVenueApproved={loadVenues}
        />
      ) : activeView === 'partner-onboarding' ? (
        <PartnerOnboardingView
          user={user}
          venues={venues}
          onBack={() => resetViews(true)}
          onAuthModalOpen={() => setShowAuthModal(true)}
        />
      ) : activeView === 'bookings' ? (
        <UserBookingsView
          user={user}
          bookings={bookings}
          onBack={() => resetViews(true)}
          onCancel={handleCancelBooking}
        />
      ) : activeView === 'venue-admin' ? (
        <Dashboard
          user={user}
          bookings={bookings}
          venues={venues}
          hasActiveCoach={hasActiveCoach}
          onBack={() => resetViews(true)}
          onCancel={handleCancelBooking}
          onVenueUpdate={(updatedVenue) => {
            setVenues((prev) =>
              prev.map((v) =>
                v.id === updatedVenue.id
                  ? {
                      ...v,
                      ...updatedVenue,
                      facilities: updatedVenue.facilities || v.facilities || [],
                      slots: updatedVenue.slots || v.slots || [],
                    }
                  : v
              )
            );
          }}
        />
      ) : (
        <>
          <section className="mx-auto grid max-w-7xl gap-9 px-5 pb-14 pt-10 sm:pt-14 lg:grid-cols-[1.02fr_.98fr] lg:items-center lg:px-8 lg:pb-20 lg:pt-16">
            <div className="relative z-10">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-white dark:bg-[#16171A] px-3 py-2 text-xs font-bold text-[#101310] dark:text-[#F7F8F4]">
                <Sparkles size={14} className="text-[#829e12] dark:text-[#d8ff3e]" /> ONE HOME FOR EVERY GAME
              </div>
                            <h1 className="max-w-2xl text-[clamp(3.7rem,8vw,7.5rem)] font-black leading-[.86] tracking-[-.085em]">
                What&apos;s the<br />
                <span className="relative inline-block">
                  move<span className="absolute -bottom-1 left-1 h-2 w-[95%] -rotate-2 bg-[#d8ff3e] sm:h-3" />
                </span>
                <span className="relative z-10">?</span><br />
                <span className="text-[#849c24]">It's Motion.</span>
              </h1>

              <p className="mt-7 max-w-lg text-base leading-7 text-black/60 dark:text-[#F7F8F4]/70 sm:text-lg">
                From quick rallies to full-court battles. Discover and book the space where your next favourite game happens.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  onClick={() => handleNavigate('explore')}
                  className="rounded-full bg-[#101310] dark:bg-[#d8ff3e] px-6 py-4 text-sm font-bold text-white dark:text-[#101310] transition hover:-translate-y-0.5"
                >
                  Explore courts <ArrowDownRight className="ml-3 inline" size={17} />
                </button>
              </div>
            </div>
            <div className="relative min-h-[390px] sm:min-h-[510px]">
              <div className="absolute right-0 top-0 h-[88%] w-[94%] overflow-hidden rounded-[2rem] bg-[#d8ff3e]">
                <img src={DEFAULT_VENUE_IMAGE} alt="Indoor badminton court" className="h-full w-full object-cover" />
              </div>
            </div>
          </section>

          <section id="explore" className="bg-white dark:bg-[#0B0B0C] dark:border-t dark:border-white/10 py-16 sm:py-20 transition-colors">
            <div className="mx-auto max-w-7xl px-5 lg:px-8">
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.2em] text-[#81971d] dark:text-[#d8ff3e]">YOUR NEXT SESSION</p>
                  <h2 className="mt-3 text-4xl font-black tracking-[-.06em] text-[#101310] dark:text-[#F7F8F4] sm:text-5xl">Find your playing field.</h2>
                </div>
                <div className="text-sm font-semibold text-black/50 dark:text-[#F7F8F4]/60">
                  {filtered.length} courts to explore <ArrowRight className="ml-1 inline" size={16} />
                </div>
              </div>

              <div className="mt-8 grid gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-[#f7f8f4] dark:bg-[#16171A] p-3 md:grid-cols-[1.2fr_1fr_1fr_auto_auto] md:p-4">
                <label className="flex items-center gap-3 rounded-xl border border-transparent dark:border-white/10 bg-white dark:bg-[#0B0B0C] px-4 py-3">
                  <Search size={18} className="shrink-0 text-black/40 dark:text-[#F7F8F4]/40" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Sport, venue or facility..."
                    className="min-w-0 flex-1 bg-transparent text-sm text-[#101310] dark:text-[#F7F8F4] placeholder:text-black/40 dark:placeholder:text-[#F7F8F4]/40 outline-none"
                  />
                </label>
                <label className="flex items-center gap-3 rounded-xl border border-transparent dark:border-white/10 bg-white dark:bg-[#0B0B0C] px-4 py-3">
                  <MapPin size={18} className="shrink-0 text-black/40 dark:text-[#F7F8F4]/40" />
                  <select value={area} onChange={(e) => setArea(e.target.value)} className="w-full bg-transparent text-sm text-[#101310] dark:text-[#F7F8F4] outline-none">
                    <option>Anywhere in Bangkok</option>
                    <option>Phaya Thai</option>
                    <option>Sukhumvit</option>
                    <option>Chatuchak</option>
                    <option>Rama 9</option>
                    <option>Bang Na</option>
                    <option>Thong Lo</option>
                    <option>Salaya</option>
                  </select>
                </label>
                <label className="flex items-center gap-3 rounded-xl border border-transparent dark:border-white/10 bg-white dark:bg-[#0B0B0C] px-4 py-3">
                  <select value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="w-full bg-transparent text-sm text-[#101310] dark:text-[#F7F8F4] outline-none">
                    <option>Any price</option>
                    <option value="250">Up to ฿250 / hr</option>
                    <option value="500">Up to ฿500 / hr</option>
                    <option value="1000">Up to ฿1,000 / hr</option>
                  </select>
                </label>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#d8ff3e] px-5 py-3 text-sm font-extrabold text-[#101310] transition hover:bg-[#c9f02e]"
                >
                  <SlidersHorizontal size={17} /> Filters <ChevronDown size={15} />
                </button>
                {hasActiveFilters && (
                  <button
                    onClick={handleResetFilters}
                    className="flex items-center justify-center rounded-xl border border-black/15 dark:border-white/10 bg-white dark:bg-[#0B0B0C] px-4 py-3 text-sm font-bold text-black/70 dark:text-[#F7F8F4]/80 transition hover:bg-black/5 dark:hover:bg-white/10 hover:text-black dark:hover:text-[#F7F8F4]"
                  >
                    Reset
                  </button>
                )}
              </div>

              {showFilters && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-black/10 dark:border-white/10 bg-[#f7f8f4] dark:bg-[#16171A] p-3">
                  {SPORTS_LIST.map((s) => (
                    <button
                      key={s.name}
                      onClick={() => setActiveSport(s.name)}
                      className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                        activeSport === s.name
                          ? 'bg-[#101310] dark:bg-[#d8ff3e] text-white dark:text-[#101310]'
                          : 'bg-white dark:bg-[#0B0B0C] text-[#101310] dark:text-[#F7F8F4] border border-transparent dark:border-white/10'
                      }`}
                    >
                      {s.icon} {s.name}
                    </button>
                  ))}
                </div>
              )}

              {loading ? (
                <div className="mt-12 text-center text-sm font-bold text-black/50 dark:text-[#F7F8F4]/60">Loading courts from database...</div>
              ) : filtered.length ? (
                <div className="mt-6 grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((v) => (
                    <VenueCard key={v.id} venue={v} onSelect={() => handleOpenVenueModal(v)} />
                  ))}
                </div>
              ) : (
                <div className="mt-8 rounded-2xl border border-dashed border-black/20 dark:border-white/15 bg-transparent dark:bg-[#16171A] p-12 text-center">
                  <p className="text-3xl">🔎</p>
                  <h3 className="mt-3 text-xl font-black text-[#101310] dark:text-[#F7F8F4]">No courts found</h3>
                  <button
                    onClick={handleResetFilters}
                    className="mt-4 rounded-full bg-[#101310] dark:bg-[#d8ff3e] px-5 py-2.5 text-xs font-bold text-white dark:text-[#101310] transition hover:bg-black/80 dark:hover:bg-[#c9f02e]"
                  >
                    Reset filters
                  </button>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      <footer className="border-t border-black/10 dark:border-white/10 bg-[#f7f8f4] dark:bg-[#16171A] transition-colors">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <button className="flex items-center gap-2 self-start" onClick={() => handleNavigate()}>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#101310] dark:bg-[#d8ff3e] text-[#d8ff3e] dark:text-[#101310]">
              <Zap size={17} fill="currentColor" />
            </span>
            <span className="text-xl font-black tracking-[-.08em] text-[#101310] dark:text-[#F7F8F4]">motion.</span>
          </button>
          <p className="text-xs text-black/45 dark:text-[#F7F8F4]/50">© 2026 Motion. Built for the love of the game.</p>
        </div>
      </footer>

      {selected && (
        <VenueModal
          venue={selected}
          date={selectedDate}
          setDate={setSelectedDate}
          user={user}
          onClose={handleCloseVenueModal}
          onBookSuccess={(newBooking) => {
            setBookings((old) => [newBooking, ...old]);
            setConfirmed(newBooking);
            navigateTo(activeView, null);
          }}
        />
      )}

      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} onSuccess={() => setShowAuthModal(false)} />
      )}

      {confirmed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          onClick={() => setConfirmed(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-transparent dark:border-white/10 bg-white dark:bg-[#16171A] p-7 sm:p-9"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#d8ff3e] text-[#101310]">
              <Check size={30} strokeWidth={3} />
            </div>

            <h2 className="mt-4 text-3xl font-black tracking-tight text-[#101310] dark:text-[#F7F8F4]">You're in. Game on!</h2>

            <div className="mt-4 rounded-2xl border border-transparent dark:border-white/10 bg-[#f7f8f4] dark:bg-[#0B0B0C] p-4 text-sm space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-extrabold text-[#101310] dark:text-[#F7F8F4]">{confirmed.venue}</p>
                  <p className="text-xs text-black/50 dark:text-[#F7F8F4]/60 mt-0.5">{confirmed.date} · {confirmed.time}</p>
                </div>
                <p className="font-black text-[#101310] dark:text-[#F7F8F4]">{money(confirmed.price)}</p>
              </div>

              {(user || (confirmed.pointsEarned && confirmed.pointsEarned > 0)) && (
                <div className="flex items-center justify-between border-t border-black/10 dark:border-white/10 pt-2 text-xs font-bold text-[#5d7112] dark:text-[#d8ff3e]">
                  <span>⚡ Points Earned:</span>
                  <span className="rounded-full bg-[#d8ff3e] px-2.5 py-0.5 font-black text-[#101310]">
                    +{confirmed.pointsEarned || Math.floor(confirmed.price / 10)} PTS
                  </span>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <button
                onClick={() => {
                  setConfirmed(null);
                  handleBookingsOpen();
                }}
                className="w-full rounded-full bg-[#101310] dark:bg-[#d8ff3e] py-3 text-sm font-bold text-white dark:text-[#101310] transition hover:bg-[#30372a] dark:hover:bg-[#c9f02e]"
              >
                View my bookings
              </button>

              <button
                onClick={() => setConfirmed(null)}
                className="w-full rounded-full border border-black/10 dark:border-white/10 bg-transparent py-2.5 text-xs font-bold text-black/60 dark:text-[#F7F8F4]/70 transition hover:bg-black/5 dark:hover:bg-white/10 hover:text-black dark:hover:text-[#F7F8F4]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}