'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  MapPin,
  Search,
  SlidersHorizontal,
  Sparkles,
  Zap,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { venueService } from '@/lib/services/venueService';
import { bookingService, type Booking } from '@/lib/services/bookingService';
import { SPORTS_LIST, DEFAULT_VENUE_IMAGE } from '@/lib/constants';
import type { Sport, Venue } from '@/lib/data';

import Navbar from '@/components/Navbar';
import AuthModal from '@/components/AuthModal';
import VenueCard from '@/components/VenueCard';
import VenueModal from '@/components/VenueModal';
import UserBookingsView from '@/components/UserBookingsView';
import Dashboard from '@/components/Dashboard';
import PartnerOnboardingView from '@/components/PartnerOnboardingView';

const money = (n: number) => `฿${n.toLocaleString('en-US')}`;
const today = new Date();
const dateLabel = (d: Date) => d.toLocaleDateString('en-CA');

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

  const [showUserBookings, setShowUserBookings] = useState(false);
  const [showVenueAdmin, setShowVenueAdmin] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const handleNavigate = (targetId?: string) => {
    setShowUserBookings(false);
    setShowVenueAdmin(false);
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
    venueService.getAll().then((data) => {
      setVenues(data);
      setLoading(false);
    });
  }, []);

  const handleCancelBooking = async (id: string) => {
    setBookings((old) => old.map((b) => (b.id === id ? { ...b, status: 'Cancelled' } : b)));
    await bookingService.cancel(id);
  };

  const filtered = useMemo(() => {
    return venues.filter((v) => {
      const sportMatch = activeSport === 'All sports' || v.sport === activeSport;
      const q = query.trim().toLowerCase();
      const queryMatch =
        !q || `${v.name} ${v.sport} ${v.area} ${v.facilities.join(' ')}`.toLowerCase().includes(q);
      const areaMatch =
        area === 'Anywhere in Bangkok' || v.area.toLowerCase().includes(area.toLowerCase());
      const priceMatch = maxPrice === 'Any price' || v.price <= Number(maxPrice);
      return sportMatch && queryMatch && areaMatch && priceMatch;
    });
  }, [venues, activeSport, query, area, maxPrice]);

  // Add state for Partner Onboarding view
  const [showPartnerOnboarding, setShowPartnerOnboarding] = useState(false);

  const handleVenueAdminAccess = () => {
    const isApprovedVenue =
      user?.user_metadata?.role === 'venue_owner' || user?.user_metadata?.is_approved_venue === true;
    const isApprovedCoach =
      user?.user_metadata?.role === 'coach' || user?.user_metadata?.is_approved_coach === true;

    if (isApprovedVenue || isApprovedCoach) {
      setShowUserBookings(false);
      setShowPartnerOnboarding(false);
      setShowVenueAdmin(true);
    } else {
      // Navigate smoothly to Partner Onboarding page (No popups!)
      setShowUserBookings(false);
      setShowVenueAdmin(false);
      setShowPartnerOnboarding(true);
    }
  };

  //Motion Admin Center Access
  const [showMotionAdmin, setShowMotionAdmin] = useState(false);

  const handleMotionAdminOpen = () => {
    setShowUserBookings(false);
    setShowVenueAdmin(false);
    setShowPartnerOnboarding(false);
    setShowMotionAdmin(true);
  };


  return (
    <main className="min-h-screen overflow-hidden">
      <div className="bg-[#d8ff3e] px-4 py-2 text-center text-[11px] font-extrabold uppercase tracking-[.18em] sm:text-xs">
        Your next game starts here <span className="mx-2">✳</span> Meet you on the court
      </div>

      <Navbar
        user={user}
        onNavigate={handleNavigate}
        onBookingsOpen={() => {
          setShowVenueAdmin(false);
          setShowMotionAdmin(false);
          setShowUserBookings(true);
        }}
        onVenueAdminOpen={handleVenueAdminAccess}
        onMotionAdminOpen={handleMotionAdminOpen}
        onAuthModalOpen={() => setShowAuthModal(true)}
      />

      {showPartnerOnboarding ? (
        <PartnerOnboardingView
          user={user}
          venues={venues}
          onBack={() => setShowPartnerOnboarding(false)}
          onAuthModalOpen={() => setShowAuthModal(true)}
        />
      ) : showUserBookings ? (
        <UserBookingsView
          user={user}
          bookings={bookings}
          onBack={() => setShowUserBookings(false)}
          onCancel={handleCancelBooking}
        />
      ) : showVenueAdmin ? (
        <Dashboard
          user={user}
          bookings={bookings}
          venues={venues}
          onBack={() => setShowVenueAdmin(false)}
          onCancel={handleCancelBooking}
        />
      ) : (
        <>
          <section className="mx-auto grid max-w-7xl gap-9 px-5 pb-14 pt-10 sm:pt-14 lg:grid-cols-[1.02fr_.98fr] lg:items-center lg:px-8 lg:pb-20 lg:pt-16">
            <div className="relative z-10">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-bold">
                <Sparkles size={14} className="text-[#829e12]" /> ONE HOME FOR EVERY GAME
              </div>
              <h1 className="max-w-2xl text-[clamp(3.7rem,8vw,7.5rem)] font-black leading-[.86] tracking-[-.085em]">
                Find your<br />
                <span className="relative inline-block">
                  court<span className="absolute -bottom-1 left-1 h-2 w-[95%] -rotate-2 bg-[#d8ff3e] sm:h-3" />
                </span>
                <span className="relative z-10">. Find your</span><br />
                <span className="text-[#849c24]">people.</span>
              </h1>
              <p className="mt-7 max-w-lg text-base leading-7 text-black/60 sm:text-lg">
                From quick rallies to full-court battles. Discover and book the space where your next favourite game happens.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  onClick={() => handleNavigate('explore')}
                  className="rounded-full bg-[#101310] px-6 py-4 text-sm font-bold text-white transition hover:-translate-y-0.5"
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

          <section id="explore" className="bg-white py-16 sm:py-20">
            <div className="mx-auto max-w-7xl px-5 lg:px-8">
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.2em] text-[#81971d]">YOUR NEXT SESSION</p>
                  <h2 className="mt-3 text-4xl font-black tracking-[-.06em] sm:text-5xl">Find your playing field.</h2>
                </div>
                <div className="text-sm font-semibold text-black/50">
                  {filtered.length} courts to explore <ArrowRight className="ml-1 inline" size={16} />
                </div>
              </div>

              <div className="mt-8 grid gap-3 rounded-2xl border border-black/10 bg-[#f7f8f4] p-3 md:grid-cols-[1.2fr_1fr_1fr_auto] md:p-4">
                <label className="flex items-center gap-3 rounded-xl bg-white px-4 py-3">
                  <Search size={18} className="shrink-0 text-black/40" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Sport, venue or facility..."
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                  />
                </label>
                <label className="flex items-center gap-3 rounded-xl bg-white px-4 py-3">
                  <MapPin size={18} className="shrink-0 text-black/40" />
                  <select value={area} onChange={(e) => setArea(e.target.value)} className="w-full bg-transparent text-sm outline-none">
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
                <label className="flex items-center gap-3 rounded-xl bg-white px-4 py-3">
                  <select value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="w-full bg-transparent text-sm outline-none">
                    <option>Any price</option>
                    <option value="250">Up to ฿250 / hr</option>
                    <option value="500">Up to ฿500 / hr</option>
                    <option value="1000">Up to ฿1,000 / hr</option>
                  </select>
                </label>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#d8ff3e] px-5 py-3 text-sm font-extrabold transition hover:bg-[#c9f02e]"
                >
                  <SlidersHorizontal size={17} /> Filters <ChevronDown size={15} />
                </button>
              </div>

              {showFilters && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-black/10 bg-[#f7f8f4] p-3">
                  {SPORTS_LIST.map((s) => (
                    <button
                      key={s.name}
                      onClick={() => setActiveSport(s.name)}
                      className={`rounded-full px-4 py-2 text-xs font-bold ${
                        activeSport === s.name ? 'bg-[#101310] text-white' : 'bg-white'
                      }`}
                    >
                      {s.icon} {s.name}
                    </button>
                  ))}
                </div>
              )}

              {loading ? (
                <div className="mt-12 text-center text-sm font-bold text-black/50">Loading courts from database...</div>
              ) : filtered.length ? (
                <div className="mt-6 grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((v) => (
                    <VenueCard key={v.id} venue={v} onSelect={() => setSelected(v)} />
                  ))}
                </div>
              ) : (
                <div className="mt-8 rounded-2xl border border-dashed border-black/20 p-12 text-center">
                  <p className="text-3xl">🔎</p>
                  <h3 className="mt-3 text-xl font-black">No courts found</h3>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      <footer className="border-t border-black/10 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <button className="flex items-center gap-2 self-start" onClick={() => handleNavigate()}>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#101310] text-[#d8ff3e]">
              <Zap size={17} fill="currentColor" />
            </span>
            <span className="text-xl font-black tracking-[-.08em]">motion.</span>
          </button>
          <p className="text-xs text-black/45">© 2026 Motion. Built for the love of the game.</p>
        </div>
      </footer>

      {selected && (
        <VenueModal
          venue={selected}
          date={selectedDate}
          setDate={setSelectedDate}
          user={user}
          onClose={() => setSelected(null)}
          onBookSuccess={(newBooking) => {
            setBookings((old) => [newBooking, ...old]);
            setConfirmed(newBooking);
            setSelected(null);
          }}
        />
      )}

      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} onSuccess={() => setShowAuthModal(false)} />
      )}

      {confirmed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" onClick={() => setConfirmed(null)}>
          <div className="w-full max-w-md rounded-3xl bg-white p-7 sm:p-9" onClick={(e) => e.stopPropagation()}>
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#d8ff3e]">
              <Check size={30} strokeWidth={3} />
            </div>
            <h2 className="mt-4 text-3xl font-black tracking-tight">You're in. Game on!</h2>
            <div className="mt-4 rounded-2xl bg-[#f7f8f4] p-4 text-sm">
              <p className="font-extrabold">{confirmed.venue}</p>
              <p className="text-xs text-black/50">{confirmed.date} · {confirmed.time}</p>
              <p className="mt-2 font-black">{money(confirmed.price)}</p>
            </div>
            <button onClick={() => setConfirmed(null)} className="mt-6 w-full rounded-full bg-[#101310] py-3 text-sm font-bold text-white">
              Done
            </button>
          </div>
        </div>
      )}
    </main>
  );
}