'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronDown, MapPin, Menu, Search, ShieldCheck, SlidersHorizontal, Sparkles, Star, X, Zap } from 'lucide-react';
import { sports, type Sport, type Venue } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import AuthModal from '@/components/AuthModal';
import BookingModal from '@/components/BookingModal';

type Booking = { 
  id: string; 
  venue: string; 
  sport: string; 
  date: string; 
  time: string; 
  price: number; 
  status: 'Confirmed' | 'Cancelled';
  pointsEarned?: number;
};

const money = (n: number) => `฿${n.toLocaleString('en-US')}`;
const today = new Date();
const dateLabel = (d: Date) => d.toLocaleDateString('en-CA');
const DEFAULT_IMG = "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=800&q=80";

export default function Home() {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
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
  const [selectedTime, setSelectedTime] = useState('18:00');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [confirmed, setConfirmed] = useState<Booking | null>(null);
  
  // View states for user bookings vs venue admin portal
  const [showUserBookings, setShowUserBookings] = useState(false);
  const [showVenueAdmin, setShowVenueAdmin] = useState(false);

  const [showFilters, setShowFilters] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  // Smooth navigation helper across page views
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

  // Fetch persisted bookings for the logged-in user from Supabase
  useEffect(() => {
    async function fetchUserBookings() {
      if (!user?.email) {
        setBookings([]);
        return;
      }

      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('customer_email', user.email)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching user bookings:', error);
        return;
      }

      if (data) {
        const mapped: Booking[] = data.map((b: any) => ({
          id: b.booking_code || String(b.id),
          venue: b.venue_name || 'Court Booking',
          sport: b.sport || 'Sports',
          date: b.booking_date,
          time: b.booking_time || b.time_slot,
          price: Number(b.total_amount || b.price || 0),
          status: b.status === 'Cancelled' ? 'Cancelled' : 'Confirmed',
          pointsEarned: b.points_earned || 0,
        }));
        setBookings(mapped);
      }
    }

    fetchUserBookings();
  }, [user]);

  useEffect(() => {
    async function fetchVenues() {
      setLoading(true);
      const { data, error } = await supabase.from('venues').select('*');
      if (error) {
        console.error('Error fetching venues from Supabase:', error);
      } else if (data) {
        const normalized: Venue[] = data.map((v: any) => ({
          ...v,
          price: Number(v.price ?? v.price_per_hour ?? 0),
          image: v.image || v.image_url || DEFAULT_IMG,
          facilities: Array.isArray(v.facilities) ? v.facilities : [],
          slots: Array.isArray(v.slots) ? v.slots : ['09:00', '10:00', '14:00', '18:00', '19:00'],
          area: v.area || 'Bangkok',
          sport: v.sport || 'Sports',
        }));
        setVenues(normalized);
      }
      setLoading(false);
    }
    fetchVenues();
  }, []);

  const handleCancelBooking = async (id: string) => {
    setBookings((old) =>
      old.map((b) => (b.id === id ? { ...b, status: 'Cancelled' } : b))
    );

    const { error } = await supabase
      .from('bookings')
      .update({ status: 'Cancelled' })
      .or(`booking_code.eq.${id},id.eq.${id}`);

    if (error) {
      console.error('Failed to update booking status in Supabase:', error);
    }
  };

  const filtered = useMemo(() => venues.filter(v => {
    const sportMatch = activeSport === 'All sports' || v.sport === activeSport;
    const q = query.trim().toLowerCase();
    const queryMatch = !q || `${v.name} ${v.sport} ${v.area} ${v.facilities.join(' ')}`.toLowerCase().includes(q);
    const areaMatch = area === 'Anywhere in Bangkok' || v.area.toLowerCase().includes(area.toLowerCase());
    const priceMatch = maxPrice === 'Any price' || v.price <= Number(maxPrice);
    return sportMatch && queryMatch && areaMatch && priceMatch;
  }), [venues, activeSport, query, area, maxPrice]);

  function openVenue(v: Venue) { setSelected(v); setSelectedTime(v.slots.includes('18:00') ? '18:00' : (v.slots[0] || '18:00')); }

  const handleVenueAdminAccess = () => {
    const isApprovedVenue = user?.user_metadata?.role === 'venue_owner' || user?.user_metadata?.is_approved_venue === true;
    if (isApprovedVenue) {
      setShowUserBookings(false);
      setShowVenueAdmin(true);
    } else {
      alert('Access restricted: Your account is not an approved venue account. Please apply to list your venue on Motion.');
    }
  };

  return (
    <main className="min-h-screen overflow-hidden">
      <div className="bg-[#d8ff3e] px-4 py-2 text-center text-[11px] font-extrabold uppercase tracking-[.18em] sm:text-xs">
        Your next game starts here <span className="mx-2">✳</span> Meet you on the court
      </div>

      <header className="relative z-20 border-b border-black/5 bg-[#f7f8f4]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          {/* Logo */}
          <button
            className="flex items-center gap-2"
            onClick={() => handleNavigate()}
            aria-label="Motion home"
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#101310] text-[#d8ff3e]">
              <Zap size={21} fill="currentColor" strokeWidth={2.5} />
            </span>
            <span className="text-2xl font-black tracking-[-.08em]">
              motion<span className="text-[#7b941c]">.</span>
            </span>
          </button>

          {/* Desktop Nav Links */}
          <nav className="hidden items-center gap-8 text-sm font-semibold md:flex">
            <button 
              onClick={() => handleNavigate('explore')} 
              className="hover:opacity-60 transition"
            >
              Explore courts
            </button>
            <button 
              onClick={() => handleNavigate('how-it-works')} 
              className="hover:opacity-60 transition"
            >
              How it works
            </button>
            <button 
              onClick={handleVenueAdminAccess} 
              className="hover:opacity-60 transition"
            >
              For venues ↗
            </button>
          </nav>

          {/* Header Action Controls */}
          <div className="hidden items-center gap-3 sm:flex">
            {user ? (
              <AccountDropdown 
                user={user} 
                onBookingsOpen={() => {
                  setShowVenueAdmin(false);
                  setShowUserBookings(true);
                }}
                onVenueAdminOpen={handleVenueAdminAccess}
              />
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="rounded-full bg-[#101310] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#30372a]"
              >
                Sign In / Sign Up
              </button>
            )}

            <button
              onClick={() => handleNavigate('explore')}
              className="rounded-full bg-[#d8ff3e] px-5 py-2.5 text-sm font-bold text-black transition hover:bg-[#c9f02e]"
            >
              Find a court <ArrowUpRight className="ml-1 inline" size={16} />
            </button>
          </div>

          {/* Mobile Hamburger Button */}
          <button className="sm:hidden" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Toggle menu">
            {mobileMenu ? <X /> : <Menu />}
          </button>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenu && (
          <div className="border-t border-black/10 px-5 py-4 md:hidden bg-white shadow-lg space-y-3">
            <button
              className="block w-full text-left py-2 font-semibold text-sm"
              onClick={() => {
                handleNavigate('explore');
                setMobileMenu(false);
              }}
            >
              Explore courts
            </button>
            <button
              className="block w-full text-left py-2 font-semibold text-sm"
              onClick={() => {
                handleNavigate('how-it-works');
                setMobileMenu(false);
              }}
            >
              How it works
            </button>
            <button
              className="block w-full text-left py-2 font-semibold text-sm"
              onClick={() => {
                handleVenueAdminAccess();
                setMobileMenu(false);
              }}
            >
              For venues ↗
            </button>

            <div className="border-t border-black/10 pt-3">
              {user ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5 px-1 py-1">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-[#101310] text-xs font-black text-[#d8ff3e]">
                      {(user.user_metadata?.full_name || user.email || 'U')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-black">
                        {user.user_metadata?.full_name || 'Account'}
                      </p>
                      <p className="truncate text-[10px] text-black/50">{user.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowVenueAdmin(false);
                      setShowUserBookings(true);
                      setMobileMenu(false);
                    }}
                    className="w-full rounded-xl bg-[#f7f8f4] py-2 text-center text-xs font-bold text-black"
                  >
                    📋 My Bookings
                  </button>
                  <button
                    onClick={() => {
                      handleVenueAdminAccess();
                      setMobileMenu(false);
                    }}
                    className="w-full rounded-xl bg-[#eef7cf] py-2 text-center text-xs font-bold text-[#5e7310]"
                  >
                    🏟️ Venue Control Centre
                  </button>
                  <button
                    onClick={() => {
                      supabase.auth.signOut();
                      setMobileMenu(false);
                    }}
                    className="w-full rounded-xl border border-red-200 bg-red-50 py-2 text-center text-xs font-bold text-red-600"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setShowAuthModal(true);
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

      {/* VIEW CONDITIONAL SWITCHING */}
      {showUserBookings ? (
        <UserBookingsView 
          user={user}
          bookings={bookings} 
          onBack={() => setShowUserBookings(false)} 
          onCancel={handleCancelBooking}
        />
      ) : showVenueAdmin ? (
        <Dashboard 
          bookings={bookings} 
          venues={venues} 
          onBack={() => setShowVenueAdmin(false)} 
          onCancel={handleCancelBooking}
        />
      ) : (
        <>
          <section className="mx-auto grid max-w-7xl gap-9 px-5 pb-14 pt-10 sm:pt-14 lg:grid-cols-[1.02fr_.98fr] lg:items-center lg:px-8 lg:pb-20 lg:pt-16">
            <div className="relative z-10">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-bold"><Sparkles size={14} className="text-[#829e12]"/> ONE HOME FOR EVERY GAME</div>
              <h1 className="max-w-2xl text-[clamp(3.7rem,8vw,7.5rem)] font-black leading-[.86] tracking-[-.085em]">Find your<br/><span className="relative inline-block">court<span className="absolute -bottom-1 left-1 h-2 w-[95%] -rotate-2 bg-[#d8ff3e] sm:h-3"/></span><span className="relative z-10">. Find your</span><br/><span className="text-[#849c24]">people.</span></h1>
              <p className="mt-7 max-w-lg text-base leading-7 text-black/60 sm:text-lg">From quick rallies to full-court battles. Discover and book the space where your next favourite game happens.</p>
              <div className="mt-8 flex flex-wrap items-center gap-4"><button onClick={() => handleNavigate('explore')} className="rounded-full bg-[#101310] px-6 py-4 text-sm font-bold text-white transition hover:-translate-y-0.5">Explore courts <ArrowDownRight className="ml-3 inline" size={17}/></button><div className="flex items-center gap-2 text-xs font-semibold text-black/55"><span className="flex -space-x-2"><span className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#f7f8f4] bg-[#f3c8a9]">🏸</span><span className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#f7f8f4] bg-[#d8e6a4]">🎾</span><span className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#f7f8f4] bg-[#d7d7f3]">🏀</span></span>Good games, all in one place</div></div>
              <div className="mt-12 grid max-w-md grid-cols-3 border-t border-black/10 pt-5"><div><p className="text-2xl font-black tracking-tight">4<span className="text-[#849c24]">+</span></p><p className="mt-1 text-xs text-black/50">Sports to play</p></div><div><p className="text-2xl font-black tracking-tight">One</p><p className="mt-1 text-xs text-black/50">Simple platform</p></div><div><p className="text-2xl font-black tracking-tight">Your</p><p className="mt-1 text-xs text-black/50">Next game awaits</p></div></div>
            </div>
            <div className="relative min-h-[390px] sm:min-h-[510px]">
              <div className="absolute right-0 top-0 h-[88%] w-[94%] overflow-hidden rounded-[2rem] bg-[#d8ff3e]"><div className="absolute inset-0 bg-gradient-to-br from-black/0 via-black/0 to-black/30"/><img src={DEFAULT_IMG} alt="Indoor badminton court" className="h-full w-full object-cover"/><div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent"/><div className="absolute left-5 top-5 rounded-full bg-[#d8ff3e] px-4 py-2 text-[10px] font-black tracking-[.15em]">PLAY MORE. PLAN LESS.</div><div className="absolute bottom-6 left-6 text-white"><p className="text-xs font-bold uppercase tracking-[.18em] text-white/70">MAKE TIME FOR PLAY</p><p className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Game on.</p></div></div>
              <div className="absolute -bottom-1 left-0 max-w-[235px] rounded-2xl bg-white p-4 shadow-soft sm:bottom-0 sm:left-[-15px]"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-[#eaf5bd] text-xl">🏸</div><div><p className="text-sm font-extrabold">Smash Arena</p><p className="mt-1 text-xs text-black/50">Phaya Thai, Bangkok</p></div><span className="ml-auto text-xs font-extrabold">฿220<span className="font-medium text-black/40">/hr</span></span></div><div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-black/50"><Star size={12} fill="#d6a927" stroke="#d6a927"/> 4.9 <span className="mx-1">·</span><span className="rounded-full bg-[#f0f5df] px-2 py-1 text-[#586c12]">AVAILABLE TODAY</span></div></div>
              <div className="absolute right-0 top-[44%] grid h-16 w-16 rotate-6 place-items-center rounded-2xl bg-[#d8ff3e] text-[#101310] shadow-lg sm:right-[-5px] sm:h-20 sm:w-20"><Zap size={31} fill="currentColor"/></div>
            </div>
          </section>

          <section id="explore" className="bg-white py-16 sm:py-20">
            <div className="mx-auto max-w-7xl px-5 lg:px-8">
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[.2em] text-[#81971d]">YOUR NEXT SESSION</p><h2 className="mt-3 text-4xl font-black tracking-[-.06em] sm:text-5xl">Find your playing field.</h2><p className="mt-3 text-sm text-black/55 sm:text-base">Good courts. Clear prices. Less back-and-forth.</p></div><div className="text-sm font-semibold text-black/50">{filtered.length} courts to explore <ArrowRight className="ml-1 inline" size={16}/></div></div>
              <div className="mt-8 grid gap-3 rounded-2xl border border-black/10 bg-[#f7f8f4] p-3 md:grid-cols-[1.2fr_1fr_1fr_auto] md:p-4">
                <label className="flex items-center gap-3 rounded-xl bg-white px-4 py-3"><Search size={18} className="shrink-0 text-black/40"/><span className="sr-only">Search courts</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Sport, venue or facility..." className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-black/40"/></label>
                <label className="flex items-center gap-3 rounded-xl bg-white px-4 py-3"><MapPin size={18} className="shrink-0 text-black/40"/><span className="sr-only">Area</span><select value={area} onChange={e => setArea(e.target.value)} className="w-full bg-transparent text-sm outline-none"><option>Anywhere in Bangkok</option><option>Phaya Thai</option><option>Sukhumvit</option><option>Chatuchak</option><option>Rama 9</option><option>Bang Na</option><option>Thong Lo</option></select></label>
                <label className="flex items-center gap-3 rounded-xl bg-white px-4 py-3"><span className="text-sm font-bold text-black/45">฿</span><span className="sr-only">Maximum hourly price</span><select value={maxPrice} onChange={e => setMaxPrice(e.target.value)} className="w-full bg-transparent text-sm outline-none"><option>Any price</option><option value="250">Up to ฿250 / hr</option><option value="500">Up to ฿500 / hr</option><option value="1000">Up to ฿1,000 / hr</option></select></label>
                <button onClick={() => setShowFilters(!showFilters)} className="flex items-center justify-center gap-2 rounded-xl bg-[#d8ff3e] px-5 py-3 text-sm font-extrabold transition hover:bg-[#c9f02e]"><SlidersHorizontal size={17}/> Filters <ChevronDown size={15}/></button>
              </div>
              {showFilters && <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-black/10 bg-[#f7f8f4] p-3"><span className="mr-2 text-xs font-bold uppercase tracking-wider text-black/45">Quick sport filter</span>{sports.map(s => <button key={s.name} onClick={() => setActiveSport(s.name)} className={`rounded-full px-4 py-2 text-xs font-bold ${activeSport === s.name ? 'bg-[#101310] text-white' : 'bg-white hover:bg-[#e9eddf]'}`}>{s.icon} {s.name}</button>)}<button onClick={() => {setActiveSport('All sports');setQuery('');setArea('Anywhere in Bangkok');setMaxPrice('Any price')}} className="ml-auto px-3 py-2 text-xs font-bold underline">Reset</button></div>}
              <div className="mt-7 flex gap-2 overflow-x-auto pb-2">{sports.map(s => <button key={s.name} onClick={() => setActiveSport(s.name)} className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-3 text-sm font-bold transition ${activeSport === s.name ? 'border-[#101310] bg-[#101310] text-white' : 'border-black/10 bg-white hover:border-black/40'}`}><span>{s.icon}</span>{s.name}</button>)}</div>
              
              {loading ? (
                <div className="mt-12 text-center text-sm font-bold text-black/50">Loading courts from database...</div>
              ) : filtered.length ? (
                <div className="mt-6 grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">{filtered.map(v => <VenueCard key={v.id} venue={v} onSelect={() => openVenue(v)}/>)}</div>
              ) : (
                <div className="mt-8 rounded-2xl border border-dashed border-black/20 p-12 text-center"><p className="text-3xl">🔎</p><h3 className="mt-3 text-xl font-black">No courts found just yet</h3><p className="mt-2 text-sm text-black/50">Try a different sport, location or price range.</p><button onClick={() => {setActiveSport('All sports');setQuery('');setArea('Anywhere in Bangkok');setMaxPrice('Any price')}} className="mt-4 rounded-full bg-[#101310] px-5 py-3 text-sm font-bold text-white">Clear filters</button></div>
              )}
              
              <div className="mt-12 flex flex-col items-center justify-between gap-4 rounded-3xl bg-[#d8ff3e] p-7 sm:flex-row sm:p-10"><div><p className="text-xs font-black uppercase tracking-[.2em]">OWN A COURT?</p><h3 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Get your venue in the game.</h3><p className="mt-2 max-w-lg text-sm text-black/65">Manage your court listings and bookings in one place. Let's make it easier for players to find you.</p></div><button onClick={handleVenueAdminAccess} className="shrink-0 rounded-full bg-[#101310] px-6 py-4 text-sm font-bold text-white">Venue dashboard <ArrowUpRight className="ml-2 inline" size={17}/></button></div>
            </div>
          </section>

          <section id="how-it-works" className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20"><p className="text-xs font-black uppercase tracking-[.2em] text-[#81971d]">THAT'S THE MOTION</p><h2 className="mt-3 max-w-xl text-4xl font-black tracking-[-.06em] sm:text-5xl">Less admin. More action.</h2><div className="mt-9 grid gap-4 sm:grid-cols-3">{[{n:'01',title:'Find your fit',body:'Pick your sport, explore courts nearby and compare the details that matter.'},{n:'02',title:'Choose your time',body:'Check available demo slots and find a time that works for your crew.'},{n:'03',title:'Get out there',body:'Confirm your selection and keep your session details in one place.'}].map(x => <div key={x.n} className="rounded-2xl border border-black/10 bg-white p-6"><div className="flex items-center justify-between"><span className="text-xs font-black tracking-[.2em] text-[#81971d]">STEP {x.n}</span><ArrowUpRight size={19}/></div><h3 className="mt-9 text-2xl font-black tracking-tight">{x.title}</h3><p className="mt-3 text-sm leading-6 text-black/55">{x.body}</p></div>)}</div></section>
        </>
      )}

      <footer className="border-t border-black/10 bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 sm:flex-row sm:items-center sm:justify-between lg:px-8"><button className="flex items-center gap-2 self-start" onClick={() => handleNavigate()}><span className="grid h-8 w-8 place-items-center rounded-full bg-[#101310] text-[#d8ff3e]"><Zap size={17} fill="currentColor"/></span><span className="text-xl font-black tracking-[-.08em]">motion.</span></button><p className="text-xs text-black/45">© 2026 Motion. Built for the love of the game.</p><p className="rounded-full bg-[#f7f8f4] px-3 py-2 text-[10px] font-black tracking-[.12em] text-black/50">PROTOTYPE · SAMPLE DATA ONLY</p></div></footer>

      {showConfirmModal && selected && (
        <BookingModal
          bookingDetails={{
            itemType: 'court',
            itemName: selected.name,
            venueName: selected.name,
            sport: selected.sport,
            price: selected.price,
            date: selectedDate,
            timeSlot: selectedTime,
          }}
          onClose={() => setShowConfirmModal(false)}
        />
      )}

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
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => setShowAuthModal(false)}
        />
      )}

      {/* CONFIRMATION POPUP */}
      {confirmed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-3xl bg-white p-7 sm:p-9">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#d8ff3e]">
              <Check size={30} strokeWidth={3} />
            </div>
            <p className="mt-6 text-xs font-black uppercase tracking-[.2em] text-[#81971d]">BOOKING CREATED</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight">You're in. Game on!</h2>
            
            <div className="mt-6 rounded-2xl bg-[#f7f8f4] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-extrabold">{confirmed.venue}</p>
                  <p className="mt-1 text-sm text-black/50">{confirmed.sport}</p>
                </div>
                <span className="rounded-full bg-[#e7f3bc] px-3 py-1 text-[10px] font-black">{confirmed.id}</span>
              </div>
              
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-black/45">Date</p>
                  <p className="mt-1 font-bold">{confirmed.date}</p>
                </div>
                <div>
                  <p className="text-xs text-black/45">Time</p>
                  <p className="mt-1 font-bold">{confirmed.time}</p> 
                </div>
              </div>
              
              <div className="mt-4 flex justify-between border-t border-black/10 pt-3 text-sm">
                <span className="text-black/50">Total Paid</span>
                <span className="font-black">{money(confirmed.price)}</span>
              </div>

              {/* EARNED POINTS BANNER */}
              {user && confirmed.pointsEarned ? (
                <div className="mt-3 flex items-center justify-between rounded-xl bg-[#d8ff3e]/30 px-3 py-2 text-xs border border-[#8caa1e]/20">
                  <span className="font-extrabold text-black/80">⚡ Points Earned</span>
                  <span className="font-black text-[#5e7310]">+{confirmed.pointsEarned} PTS</span>
                </div>
              ) : null}
            </div>
            
            <div className="mt-6 flex gap-3">
              <button 
                onClick={() => { 
                  setConfirmed(null); 
                  setShowVenueAdmin(false);
                  setShowUserBookings(true); 
                }} 
                className="flex-1 rounded-full bg-[#101310] px-4 py-3 text-sm font-bold text-white"
              >
                View bookings
              </button>
              <button onClick={() => setConfirmed(null)} className="rounded-full border border-black/15 px-4 py-3 text-sm font-bold">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function AccountDropdown({ 
  user, 
  onBookingsOpen, 
  onVenueAdminOpen 
}: { 
  user: any; 
  onBookingsOpen: () => void; 
  onVenueAdminOpen: () => void; 
}) {
  const [open, setOpen] = useState(false);

  const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
  const initial = displayName[0].toUpperCase();
  const isApprovedVenue = user.user_metadata?.role === 'venue_owner' || user.user_metadata?.is_approved_venue === true;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-full border border-black/15 bg-white px-3 py-1.5 text-xs font-bold text-black transition hover:bg-black/5"
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-[#101310] text-[11px] font-black text-[#d8ff3e]">
          {initial}
        </span>
        <span className="max-w-[100px] truncate">{displayName}</span>
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
                    onVenueAdminOpen(); // Trigger alert verification
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

function UserBookingsView({ 
  user, 
  bookings, 
  onBack, 
  onCancel 
}: { 
  user: any; 
  bookings: Booking[]; 
  onBack: () => void; 
  onCancel: (id: string) => void;
}) {
  const activeBookings = bookings.filter(b => b.status === 'Confirmed');

  return (
    <section className="mx-auto min-h-[75vh] max-w-4xl px-5 py-10 lg:px-8 lg:py-16">
      <button onClick={onBack} className="mb-7 flex items-center gap-2 text-sm font-bold text-black/55 hover:text-black">
        <ArrowLeft size={17}/> Back to discovery
      </button>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[.2em] text-[#81971d]">PLAYER ACCOUNT</p>
          <h1 className="mt-2 text-4xl font-black tracking-[-.06em]">My Bookings</h1>
          <p className="mt-1 text-sm text-black/55">Manage your active reservations and game history.</p>
        </div>
        {user && (
          <span className="self-start sm:self-auto rounded-full bg-[#eef7cf] px-4 py-2 text-xs font-black text-[#586c12]">
            ⚡ Points Earned: {activeBookings.reduce((sum, b) => sum + (b.pointsEarned || 0), 0)} PTS
          </span>
        )}
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-black/10 bg-white">
        {bookings.length ? (
          <div className="divide-y divide-black/5">
            {bookings.map((b) => (
              <div key={b.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#81971d]">{b.sport}</span>
                  <p className="font-extrabold text-base text-black">{b.venue}</p>
                  <p className="mt-1 text-xs text-black/50">{b.date} · {b.time} · Ref: {b.id}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-3 py-1 text-[10px] font-black ${b.status==='Confirmed'?'bg-[#edf5d2] text-[#5d7112]':'bg-gray-100 text-gray-500'}`}>
                    {b.status}
                  </span>
                  <b className="text-sm">{money(b.price)}</b>
                  {b.status === 'Confirmed' && (
                    <button onClick={() => onCancel(b.id)} className="text-xs font-bold text-red-600 underline ml-2">
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <CalendarDays className="mx-auto text-black/25" size={32}/>
            <p className="mt-3 font-extrabold text-lg">No active bookings yet</p>
            <p className="mt-1 text-sm text-black/45">Explore available courts and book your next session!</p>
            <button onClick={onBack} className="mt-5 rounded-full bg-[#101310] px-6 py-3 text-xs font-bold text-white">
              Find a court
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function VenueCard({ venue, onSelect }: { venue: Venue; onSelect: () => void }) {
  return <article className="group cursor-pointer" onClick={onSelect}><div className="relative overflow-hidden rounded-2xl bg-[#e8ebdf]"><img src={venue.image || DEFAULT_IMG} alt={`${venue.sport} at ${venue.name}`} className="h-56 w-full object-cover transition duration-500 group-hover:scale-[1.04]"/>{venue.tag && <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-2 text-[9px] font-black tracking-[.13em]">{venue.tag}</span>}<span className="absolute bottom-3 right-3 grid h-10 w-10 place-items-center rounded-full bg-[#d8ff3e] transition group-hover:rotate-45"><ArrowUpRight size={19}/></span></div><div className="pt-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.15em] text-[#81971d]">{venue.sport}</p><h3 className="mt-1 text-xl font-black tracking-tight">{venue.name}</h3></div><div className="flex items-center gap-1 pt-1 text-xs font-extrabold"><Star size={13} fill="#d6a927" stroke="#d6a927"/>{venue.rating || 'New'}<span className="font-medium text-black/35">({venue.reviews || 0})</span></div></div><p className="mt-2 flex items-center gap-1.5 text-sm text-black/50"><MapPin size={14}/>{venue.area}</p><div className="mt-4 flex items-end justify-between border-t border-black/10 pt-3"><div><span className="text-xl font-black">{money(venue.price)}</span><span className="text-xs text-black/45"> / hour</span></div><span className="text-xs font-bold">View court <ArrowRight className="ml-1 inline" size={14}/></span></div></div></article>;
}

function VenueModal({
  venue,
  date,
  setDate,
  user,
  onClose,
  onBookSuccess,
}: {
  venue: Venue;
  date: string;
  setDate: (v: string) => void;
  user?: any;
  onClose: () => void;
  onBookSuccess: (booking: Booking) => void;
}) {
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [slotBookings, setSlotBookings] = useState<Record<string, number>>({});
  const [loadingAvailability, setLoadingAvailability] = useState(true);

  const ALL_SLOTS = [
    '09:00 - 10:00',
    '10:00 - 11:00',
    '11:00 - 12:00',
    '12:00 - 13:00',
    '13:00 - 14:00',
    '14:00 - 15:00',
    '15:00 - 16:00',
    '16:00 - 17:00',
    '17:00 - 18:00',
    '18:00 - 19:00',
    '19:00 - 20:00',
    '20:00 - 21:00',
    '21:00 - 22:00',
  ];

  const [selectedSlots, setSelectedSlots] = useState<string[]>(['14:00 - 15:00']);
  const [courtCount, setCourtCount] = useState<number>(1);

  const totalCourts = venue.total_courts || 4;

  useEffect(() => {
    if (user) {
      setCustomerEmail(user.email || '');
      setCustomerName(user.user_metadata?.full_name || '');
    }
  }, [user]);

  useEffect(() => {
    async function fetchAvailability() {
      if (!venue.id || !date) return;
      setLoadingAvailability(true);

      const { data, error } = await supabase
        .from('bookings')
        .select('booking_time, time_slot, court_count')
        .eq('venue_id', venue.id)
        .eq('booking_date', date)
        .neq('status', 'Cancelled');

      if (error) {
        console.error('Error fetching slot availability:', error);
        setLoadingAvailability(false);
        return;
      }

      const counts: Record<string, number> = {};
      data?.forEach((booking) => {
        const bookedQuantity = Number(booking.court_count || 1);
        const rawSlotStr = String(booking.time_slot || booking.booking_time || '');
        
        ALL_SLOTS.forEach((fullSlot) => {
          const startTime = fullSlot.split(' - ')[0];
          if (rawSlotStr.includes(fullSlot) || rawSlotStr.includes(startTime)) {
            counts[fullSlot] = (counts[fullSlot] || 0) + bookedQuantity;
          }
        });
      });

      setSlotBookings(counts);
      setLoadingAvailability(false);
    }

    fetchAvailability();
  }, [venue.id, date]);

  const maxAvailableCourts = useMemo(() => {
    if (selectedSlots.length === 0) return totalCourts;
    const remainingPerSelected = selectedSlots.map((s) => {
      const booked = slotBookings[s] || 0;
      return Math.max(0, totalCourts - booked);
    });
    const calculatedMin = Math.min(...remainingPerSelected);
    return isFinite(calculatedMin) ? calculatedMin : totalCourts;
  }, [selectedSlots, slotBookings, totalCourts]);

  useEffect(() => {
    if (selectedSlots.length === 0) return;
    const firstSelectedBooked = slotBookings[selectedSlots[0]] || 0;
    if (firstSelectedBooked >= totalCourts) {
      const firstOpen = ALL_SLOTS.find((s) => (slotBookings[s] || 0) < totalCourts);
      if (firstOpen) {
        setSelectedSlots([firstOpen]);
      }
    }
  }, [slotBookings, totalCourts]);

  useEffect(() => {
    if (courtCount > maxAvailableCourts && maxAvailableCourts > 0) {
      setCourtCount(maxAvailableCourts);
    } else if (maxAvailableCourts > 0 && courtCount < 1) {
      setCourtCount(1);
    }
  }, [maxAvailableCourts, courtCount]);

  const toggleSlot = (slot: string) => {
    const currentBooked = slotBookings[slot] || 0;
    if (currentBooked >= totalCourts) return;

    if (selectedSlots.includes(slot)) {
      if (selectedSlots.length > 1) {
        setSelectedSlots(selectedSlots.filter((s) => s !== slot));
      }
    } else {
      setSelectedSlots([...selectedSlots, slot].sort());
    }
  };

  const totalHours = selectedSlots.length;
  const totalPrice = venue.price * totalHours * courtCount;

  const isFormValid =
    date &&
    date >= dateLabel(today) &&
    selectedSlots.length > 0 &&
    maxAvailableCourts > 0 &&
    courtCount <= maxAvailableCourts &&
    (user || (customerName.trim().length > 0 && customerEmail.trim().length > 0));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isFormValid || submitting) return;

    setSubmitting(true);
    setErrorMsg('');

    const bookingCode = `MO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    const sortedSlots = [...selectedSlots].sort();
    const startRange = sortedSlots[0].split(' - ')[0];
    const endRange = sortedSlots[sortedSlots.length - 1].split(' - ')[1];
    
    const formattedTimeString = sortedSlots.length === 1 
      ? sortedSlots[0] 
      : `${startRange} – ${endRange} (${sortedSlots.length} hrs)`;

    const timeSummary = selectedSlots.join(', ');

    const finalCustomerName = user 
      ? user.user_metadata?.full_name || user.email?.split('@')[0] || 'Logged In User'
      : customerName;

    const finalCustomerEmail = user 
      ? user.email || '' 
      : customerEmail;

    const pointsEarned = Math.floor(totalPrice / 10);

    const { error } = await supabase.from('bookings').insert([
      {
        booking_code: bookingCode,
        venue_id: venue.id,
        venue_name: venue.name,
        sport: venue.sport,
        booking_date: date,
        booking_time: timeSummary,
        time_slot: timeSummary,
        court_count: courtCount,
        duration_hours: totalHours,
        price: totalPrice,
        total_amount: totalPrice,
        customer_name: finalCustomerName,
        customer_email: finalCustomerEmail,
        points_earned: pointsEarned,
        status: 'Confirmed',
      },
    ]);

    if (error) {
      console.error('Error creating booking:', error.message || error);
      setErrorMsg('Failed to save booking. Please try again.');
      setSubmitting(false);
      return;
    }

    const newBooking: Booking = {
      id: bookingCode,
      venue: `${venue.name} (${courtCount} Court${courtCount > 1 ? 's' : ''})`,
      sport: venue.sport,
      date,
      time: formattedTimeString,
      price: totalPrice,
      pointsEarned: pointsEarned,
      status: 'Confirmed',
    };

    setSubmitting(false);
    onBookSuccess(newBooking);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white sm:rounded-3xl">
        <div className="relative h-48 sm:h-56">
          <img src={venue.image || DEFAULT_IMG} alt={venue.name} className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white text-black hover:bg-gray-100"
          >
            <X size={19} />
          </button>
          <span className="absolute bottom-4 left-4 rounded-full bg-[#d8ff3e] px-3 py-2 text-[10px] font-black tracking-widest text-black">
            {venue.sport.toUpperCase()}
          </span>
        </div>

        <div className="grid gap-7 p-5 sm:grid-cols-[1fr_1.1fr] sm:p-8">
          <div>
            <p className="flex items-center gap-1 text-xs font-bold text-black/50">
              <MapPin size={14} />
              {venue.area}
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-black">{venue.name}</h2>
            <div className="mt-2 flex items-center gap-1 text-sm text-black">
              <Star size={15} fill="#d6a927" stroke="#d6a927" />
              <b>{venue.rating || 'New'}</b>
              <span className="text-black/45">({venue.reviews || 0} reviews)</span>
            </div>

            <p className="mt-4 text-xs leading-5 text-black/60">
              {venue.description || 'No description provided.'}
            </p>

            <h3 className="mt-5 text-xs font-extrabold text-black uppercase">Facilities</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {venue.facilities.map((f) => (
                <span key={f} className="rounded-full bg-[#f2f4ed] px-2.5 py-1 text-[11px] font-semibold text-black">
                  {f}
                </span>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="rounded-2xl bg-[#f7f8f4] p-5 border border-black/10">
            <div className="flex items-end justify-between border-b border-black/10 pb-3">
              <h3 className="text-base font-black text-black">Select Slots</h3>
              <p className="text-black">
                <b className="text-lg">{money(venue.price)}</b>
                <span className="text-xs text-black/45">/hr/court</span>
              </p>
            </div>

            <label className="mt-3 block text-xs font-bold text-black/55 uppercase">
              Date
              <input
                type="date"
                value={date}
                min={dateLabel(today)}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-bold text-black outline-none"
              />
            </label>

            <div className="mt-3">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-bold text-black/55 uppercase">Time Slot(s)</span>
                {loadingAvailability ? (
                  <span className="text-[10px] text-black/40 font-semibold">Checking...</span>
                ) : (
                  <span className="text-[10px] font-extrabold text-[#758e1b] bg-[#eef7cf] px-2 py-0.5 rounded-full">
                    Multi-select active
                  </span>
                )}
              </div>

              <div className="max-h-40 overflow-y-auto grid grid-cols-2 gap-1.5 p-1 border border-black/10 rounded-xl bg-white">
                {ALL_SLOTS.map((slot) => {
                  const isSelected = selectedSlots.includes(slot);
                  const booked = slotBookings[slot] || 0;
                  const isFull = booked >= totalCourts;
                  const remaining = Math.max(0, totalCourts - booked);

                  return (
                    <button
                      type="button"
                      key={slot}
                      disabled={isFull}
                      onClick={() => toggleSlot(slot)}
                      className={`relative rounded-lg py-2 px-2 text-xs font-bold transition text-center flex flex-col items-center justify-center ${
                        isFull
                          ? 'bg-gray-100 text-gray-400 opacity-50 cursor-not-allowed line-through'
                          : isSelected
                          ? 'bg-[#101310] text-[#d8ff3e] shadow-sm'
                          : 'bg-[#f7f8f4] text-black hover:bg-gray-200'
                      }`}
                    >
                      <span>{slot} {isSelected && '✓'}</span>
                      <span className="text-[9px] font-normal opacity-80 mt-0.5">
                        {isFull ? 'Full' : `${remaining} courts available`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-3 border-t border-black/10 pt-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-black/70 uppercase block">Courts</label>
                  <span className="text-[10px] text-black/40">
                    Max {maxAvailableCourts} for selected time
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={courtCount <= 1}
                    onClick={() => setCourtCount((prev) => Math.max(1, prev - 1))}
                    className="h-7 w-7 rounded-lg border border-black/15 bg-white font-extrabold text-xs text-black hover:bg-gray-100 disabled:opacity-40"
                  >
                    -
                  </button>
                  <span className="w-5 text-center text-xs font-extrabold text-black">{courtCount}</span>
                  <button
                    type="button"
                    disabled={courtCount >= maxAvailableCourts || maxAvailableCourts === 0}
                    onClick={() => setCourtCount((prev) => Math.min(maxAvailableCourts, prev + 1))}
                    className="h-7 w-7 rounded-lg border border-black/15 bg-white font-extrabold text-xs text-black hover:bg-gray-100 disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-3 border-t border-black/10 pt-3">
              {user ? (
                <div className="flex items-center justify-between rounded-xl border border-black/10 bg-white px-3 py-2 text-xs">
                  <div className="min-w-0 pr-2">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-black/40">
                      Booking as
                    </p>
                    <p className="truncate font-bold text-black">
                      {user.user_metadata?.full_name || user.email}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#d8ff3e] px-2 py-0.5 text-[10px] font-black text-black">
                    ✓ Logged In
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-black/50">
                    Guest Information
                  </p>
                  <input
                    type="text"
                    required
                    placeholder="Full Name *"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs text-black outline-none focus:border-black/40"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Phone Number *"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs text-black outline-none focus:border-black/40"
                  />
                </div>
              )}
            </div>

            {errorMsg && <p className="mt-2 text-xs font-bold text-red-600">{errorMsg}</p>}

            <div className="mt-3 rounded-xl bg-[#eef7cf] p-2.5 text-xs text-black space-y-0.5">
              <div className="flex justify-between font-medium text-[11px] text-black/70">
                <span>{totalHours} hr(s) × {courtCount} court(s)</span>
                <span>{money(venue.price)}/hr</span>
              </div>
              <div className="flex justify-between items-center font-black text-sm pt-0.5 border-t border-black/10">
                <span>Total Fee</span>
                <span className="text-base text-black">{money(totalPrice)}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={!isFormValid || submitting}
              className="mt-3 w-full rounded-full bg-[#d8ff3e] py-3 text-xs font-black text-black transition hover:bg-[#c9f02e] disabled:opacity-50"
            >
              {submitting ? 'Processing...' : `Confirm Booking (${money(totalPrice)})`}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ bookings, venues, onBack, onCancel }: { bookings: Booking[]; venues: Venue[]; onBack: ()=>void; onCancel: (id:string)=>void }) {
  const [tab, setTab] = useState<'Bookings'|'Venues'>('Bookings');
  const [venueMessage, setVenueMessage] = useState('');
  const active = bookings.filter(b => b.status === 'Confirmed');
  return <section className="mx-auto min-h-[75vh] max-w-7xl px-5 py-10 lg:px-8 lg:py-16"><button onClick={onBack} className="mb-7 flex items-center gap-2 text-sm font-bold text-black/55 hover:text-black"><ArrowLeft size={17}/> Back to discovery</button><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[.2em] text-[#81971d]">VENUE CONTROL CENTRE</p><h1 className="mt-3 text-4xl font-black tracking-[-.06em] sm:text-5xl">Your game plan.</h1><p className="mt-3 text-sm text-black/55">A preview of the tools venue owners will use to manage Motion.</p></div><span className="self-start rounded-full bg-[#d8ff3e] px-4 py-2 text-xs font-black">APPROVED VENUE</span></div><div className="mt-9 grid gap-4 sm:grid-cols-3">{[{label:'Listed venues',value:String(venues.length),sub:'Live Supabase records'},{label:'Active demo bookings',value:String(active.length),sub:'Created in this session'},{label:'Demo booking value',value:money(active.reduce((sum,b)=>sum+b.price,0)),sub:'Not real revenue'}].map(c=><div key={c.label} className="rounded-2xl border border-black/10 bg-white p-5"><p className="text-sm font-semibold text-black/50">{c.label}</p><p className="mt-4 text-3xl font-black tracking-tight">{c.value}</p><p className="mt-1 text-xs text-black/40">{c.sub}</p></div>)}</div><div className="mt-9 border-b border-black/10"><div className="flex gap-6">{(['Bookings','Venues'] as const).map(t=><button key={t} onClick={()=>setTab(t)} className={`border-b-2 px-1 pb-3 text-sm font-extrabold ${tab===t?'border-[#101310]':'border-transparent text-black/45'}`}>{t}</button>)}</div></div>{tab==='Bookings' ? <div className="mt-5 overflow-hidden rounded-2xl border border-black/10 bg-white"><div className="flex items-center justify-between border-b border-black/10 p-5"><h2 className="font-black">Recent bookings</h2><span className="text-xs text-black/45">This session only</span></div>{bookings.length ? <div className="divide-y divide-black/5">{bookings.map(b=><div key={b.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#f0f4e2]">{b.sport==='Badminton'?'🏸':b.sport==='Tennis'?'🎾':b.sport==='Basketball'?'🏀':'⚽'}</div><div className="flex-1"><p className="font-extrabold">{b.venue}</p><p className="mt-1 text-xs text-black/45">{b.date} · {b.time} · {b.id}</p></div><div className="flex items-center gap-3"><span className={`rounded-full px-3 py-1.5 text-[10px] font-black ${b.status==='Confirmed'?'bg-[#edf5d2] text-[#5d7112]':'bg-gray-100 text-gray-500'}`}>{b.status}</span><b className="min-w-16 text-right">{money(b.price)}</b>{b.status==='Confirmed'&&<button onClick={()=>onCancel(b.id)} className="text-xs font-bold text-red-600 underline">Cancel</button>}</div></div>)}</div> : <div className="p-12 text-center"><CalendarDays className="mx-auto text-black/25" size={30}/><p className="mt-3 font-extrabold">No demo bookings yet</p><p className="mt-1 text-sm text-black/45">Return to Explore and create a sample booking to see it here.</p><button onClick={onBack} className="mt-4 rounded-full bg-[#101310] px-5 py-3 text-sm font-bold text-white">Explore courts</button></div>}</div> : <div className="mt-5 overflow-hidden rounded-2xl border border-black/10 bg-white"><div className="border-b border-black/10 p-5"><h2 className="font-black">Venue listings</h2><p className="mt-1 text-xs text-black/45">Live database venues</p></div><div className="divide-y divide-black/5">{venues.map(v=><div key={v.id} className="flex items-center gap-4 p-4 sm:p-5"><img src={v.image || DEFAULT_IMG} alt="" className="h-14 w-16 rounded-xl object-cover sm:h-16 sm:w-20"/><div className="min-w-0 flex-1"><p className="truncate font-extrabold">{v.name}</p><p className="mt-1 text-xs text-black/45">{v.sport} · {v.area}</p></div><div className="text-right"><p className="font-black">{money(v.price)}<span className="text-xs font-medium text-black/40">/hr</span></p><p className="mt-1 text-[10px] font-bold text-[#718617]">DATABASE LISTING</p></div></div>)}</div><div className="border-t border-black/10 bg-[#f7f8f4] p-5"><p className="text-sm font-extrabold">Need to add a venue?</p><p className="mt-1 text-xs text-black/50">Venue creation forms and saved changes are part of the next build step.</p><button onClick={()=>setVenueMessage('Venue management forms are on the next milestone. These sample listings are read-only for now.')} className="mt-3 rounded-full bg-[#101310] px-4 py-2.5 text-xs font-bold text-white">+ Add venue</button>{venueMessage&&<p className="mt-3 text-xs font-semibold text-[#667a13]">{venueMessage}</p>}</div></div>}</section>;
}