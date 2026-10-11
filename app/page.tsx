'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronDown, MapPin, Menu, Search, ShieldCheck, SlidersHorizontal, Sparkles, Star, X, Zap } from 'lucide-react';
import { sports, type Sport, type Venue } from '@/lib/data';
import { supabase } from '@/lib/supabase';

type Booking = { id: string; venue: string; sport: string; date: string; time: string; price: number; status: 'Confirmed' | 'Cancelled' };
const money = (n: number) => `฿${n.toLocaleString('en-US')}`;
const today = new Date();
const dateLabel = (d: Date) => d.toLocaleDateString('en-CA');
const DEFAULT_IMG = "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=800&q=80";

export default function Home() {
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
  const [showDashboard, setShowDashboard] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

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

  const filtered = useMemo(() => venues.filter(v => {
    const sportMatch = activeSport === 'All sports' || v.sport === activeSport;
    const q = query.trim().toLowerCase();
    const queryMatch = !q || `${v.name} ${v.sport} ${v.area} ${v.facilities.join(' ')}`.toLowerCase().includes(q);
    const areaMatch = area === 'Anywhere in Bangkok' || v.area.toLowerCase().includes(area.toLowerCase());
    const priceMatch = maxPrice === 'Any price' || v.price <= Number(maxPrice);
    return sportMatch && queryMatch && areaMatch && priceMatch;
  }), [venues, activeSport, query, area, maxPrice]);

  async function makeBooking() {
  if (!selected) return;

  const bookingData = {
    booking_code: `MO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    venue_id: selected.id,
    venue_name: selected.name,
    sport: selected.sport,
    booking_date: selectedDate,
    booking_time: selectedTime,
    price: selected.price,
    status: 'Confirmed',
  };

  // Write record directly to Supabase
  const { data, error } = await supabase
    .from('bookings')
    .insert([bookingData])
    .select()
    .single();

  if (error) {
    console.error('Error inserting booking into Supabase:', error.message || error);
  }

  // Update UI state with created booking
  const booking: Booking = {
    id: bookingData.booking_code,
    venue: selected.name,
    sport: selected.sport,
    date: selectedDate,
    time: selectedTime,
    price: selected.price,
    status: 'Confirmed',
  };

  setBookings((old) => [booking, ...old]);
  setConfirmed(booking);
  setSelected(null);
}
  function openVenue(v: Venue) { setSelected(v); setSelectedTime(v.slots.includes('18:00') ? '18:00' : (v.slots[0] || '18:00')); }

  return <main className="min-h-screen overflow-hidden">
    <div className="bg-[#d8ff3e] px-4 py-2 text-center text-[11px] font-extrabold uppercase tracking-[.18em] sm:text-xs">Your next game starts here <span className="mx-2">✳</span> Meet you on the court</div>
    <header className="relative z-20 border-b border-black/5 bg-[#f7f8f4]">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
        <button className="flex items-center gap-2" onClick={() => { setShowDashboard(false); window.scrollTo({top:0,behavior:'smooth'}); }} aria-label="Motion home"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#101310] text-[#d8ff3e]"><Zap size={21} fill="currentColor" strokeWidth={2.5}/></span><span className="text-2xl font-black tracking-[-.08em]">motion<span className="text-[#7b941c]">.</span></span></button>
        <nav className="hidden items-center gap-8 text-sm font-semibold md:flex"><a href="#explore" className="hover:opacity-60">Explore courts</a><a href="#how-it-works" className="hover:opacity-60">How it works</a><button onClick={() => setShowDashboard(true)} className="hover:opacity-60">For venues ↗</button></nav>
        <div className="hidden items-center gap-3 sm:flex"><span className="rounded-full border border-black/10 px-3 py-2 text-xs font-bold"><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#8caa1e]"/> LIVE DATABASE</span><button onClick={() => document.getElementById('explore')?.scrollIntoView({behavior:'smooth'})} className="rounded-full bg-[#101310] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#30372a]">Find a court <ArrowUpRight className="ml-2 inline" size={16}/></button></div>
        <button className="sm:hidden" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Toggle menu">{mobileMenu ? <X/> : <Menu/>}</button>
      </div>
      {mobileMenu && <div className="border-t border-black/10 px-5 py-4 md:hidden"><a className="block py-2 font-semibold" href="#explore" onClick={() => setMobileMenu(false)}>Explore courts</a><button className="block py-2 font-semibold" onClick={() => {setShowDashboard(true);setMobileMenu(false);}}>For venues ↗</button></div>}
    </header>

    {showDashboard ? <Dashboard bookings={bookings} venues={venues} onBack={() => setShowDashboard(false)} onCancel={(id) => setBookings(old => old.map(b => b.id === id ? {...b,status:'Cancelled'} : b))}/> : <>
      <section className="mx-auto grid max-w-7xl gap-9 px-5 pb-14 pt-10 sm:pt-14 lg:grid-cols-[1.02fr_.98fr] lg:items-center lg:px-8 lg:pb-20 lg:pt-16">
        <div className="relative z-10">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-bold"><Sparkles size={14} className="text-[#829e12]"/> ONE HOME FOR EVERY GAME</div>
          <h1 className="max-w-2xl text-[clamp(3.7rem,8vw,7.5rem)] font-black leading-[.86] tracking-[-.085em]">Find your<br/><span className="relative inline-block">court<span className="absolute -bottom-1 left-1 h-2 w-[95%] -rotate-2 bg-[#d8ff3e] sm:h-3"/></span><span className="relative z-10">. Find your</span><br/><span className="text-[#849c24]">people.</span></h1>
          <p className="mt-7 max-w-lg text-base leading-7 text-black/60 sm:text-lg">From quick rallies to full-court battles. Discover and book the space where your next favourite game happens.</p>
          <div className="mt-8 flex flex-wrap items-center gap-4"><button onClick={() => document.getElementById('explore')?.scrollIntoView({behavior:'smooth'})} className="rounded-full bg-[#101310] px-6 py-4 text-sm font-bold text-white transition hover:-translate-y-0.5">Explore courts <ArrowDownRight className="ml-3 inline" size={17}/></button><div className="flex items-center gap-2 text-xs font-semibold text-black/55"><span className="flex -space-x-2"><span className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#f7f8f4] bg-[#f3c8a9]">🏸</span><span className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#f7f8f4] bg-[#d8e6a4]">🎾</span><span className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#f7f8f4] bg-[#d7d7f3]">🏀</span></span>Good games, all in one place</div></div>
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
          
          <div className="mt-12 flex flex-col items-center justify-between gap-4 rounded-3xl bg-[#d8ff3e] p-7 sm:flex-row sm:p-10"><div><p className="text-xs font-black uppercase tracking-[.2em]">OWN A COURT?</p><h3 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Get your venue in the game.</h3><p className="mt-2 max-w-lg text-sm text-black/65">Manage your court listings and bookings in one place. Let's make it easier for players to find you.</p></div><button onClick={() => {setShowDashboard(true);window.scrollTo({top:0,behavior:'smooth'})}} className="shrink-0 rounded-full bg-[#101310] px-6 py-4 text-sm font-bold text-white">Venue dashboard <ArrowUpRight className="ml-2 inline" size={17}/></button></div>
        </div>
      </section>
      <section id="how-it-works" className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20"><p className="text-xs font-black uppercase tracking-[.2em] text-[#81971d]">THAT'S THE MOTION</p><h2 className="mt-3 max-w-xl text-4xl font-black tracking-[-.06em] sm:text-5xl">Less admin. More action.</h2><div className="mt-9 grid gap-4 sm:grid-cols-3">{[{n:'01',title:'Find your fit',body:'Pick your sport, explore courts nearby and compare the details that matter.'},{n:'02',title:'Choose your time',body:'Check available demo slots and find a time that works for your crew.'},{n:'03',title:'Get out there',body:'Confirm your selection and keep your session details in one place.'}].map(x => <div key={x.n} className="rounded-2xl border border-black/10 bg-white p-6"><div className="flex items-center justify-between"><span className="text-xs font-black tracking-[.2em] text-[#81971d]">STEP {x.n}</span><ArrowUpRight size={19}/></div><h3 className="mt-9 text-2xl font-black tracking-tight">{x.title}</h3><p className="mt-3 text-sm leading-6 text-black/55">{x.body}</p></div>)}</div></section>
    </>}

    <footer className="border-t border-black/10 bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 sm:flex-row sm:items-center sm:justify-between lg:px-8"><button className="flex items-center gap-2 self-start" onClick={() => {setShowDashboard(false);window.scrollTo({top:0,behavior:'smooth'})}}><span className="grid h-8 w-8 place-items-center rounded-full bg-[#101310] text-[#d8ff3e]"><Zap size={17} fill="currentColor"/></span><span className="text-xl font-black tracking-[-.08em]">motion.</span></button><p className="text-xs text-black/45">© 2026 Motion. Built for the love of the game.</p><p className="rounded-full bg-[#f7f8f4] px-3 py-2 text-[10px] font-black tracking-[.12em] text-black/50">PROTOTYPE · SAMPLE DATA ONLY</p></div></footer>

    {selected && (
  <VenueModal
    venue={selected}
    date={selectedDate}
    setDate={setSelectedDate}
    time={selectedTime}
    setTime={setSelectedTime}
    onClose={() => setSelected(null)}
    onBookSuccess={(newBooking) => {
      setBookings((old) => [newBooking, ...old]);
      setConfirmed(newBooking);
      setSelected(null);
    }}
  />
)}
    {confirmed && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-md rounded-3xl bg-white p-7 sm:p-9"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#d8ff3e]"><Check size={30} strokeWidth={3}/></div><p className="mt-6 text-xs font-black uppercase tracking-[.2em] text-[#81971d]">DEMO BOOKING CREATED</p><h2 className="mt-2 text-3xl font-black tracking-tight">You're in. Game on!</h2><p className="mt-2 text-sm leading-6 text-black/55">This is a sample reservation only. No venue has been contacted and no payment was taken.</p><div className="mt-6 rounded-2xl bg-[#f7f8f4] p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-extrabold">{confirmed.venue}</p><p className="mt-1 text-sm text-black/50">{confirmed.sport}</p></div><span className="rounded-full bg-[#e7f3bc] px-3 py-1 text-[10px] font-black">{confirmed.id}</span></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-black/45">Date</p><p className="mt-1 font-bold">{confirmed.date}</p></div><div><p className="text-xs text-black/45">Time</p><p className="mt-1 font-bold">{confirmed.time}–{String(Number(confirmed.time.slice(0,2))+1).padStart(2,'0')}:00</p></div></div><div className="mt-4 flex justify-between border-t border-black/10 pt-3 text-sm"><span className="text-black/50">Demo total</span><span className="font-black">{money(confirmed.price)}</span></div></div><div className="mt-6 flex gap-3"><button onClick={() => {setConfirmed(null);setShowDashboard(true)}} className="flex-1 rounded-full bg-[#101310] px-4 py-3 text-sm font-bold text-white">View bookings</button><button onClick={() => setConfirmed(null)} className="rounded-full border border-black/15 px-4 py-3 text-sm font-bold">Done</button></div></div></div>}
  </main>;
}

function VenueCard({ venue, onSelect }: { venue: Venue; onSelect: () => void }) {
  return <article className="group cursor-pointer" onClick={onSelect}><div className="relative overflow-hidden rounded-2xl bg-[#e8ebdf]"><img src={venue.image || DEFAULT_IMG} alt={`${venue.sport} at ${venue.name}`} className="h-56 w-full object-cover transition duration-500 group-hover:scale-[1.04]"/>{venue.tag && <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-2 text-[9px] font-black tracking-[.13em]">{venue.tag}</span>}<span className="absolute bottom-3 right-3 grid h-10 w-10 place-items-center rounded-full bg-[#d8ff3e] transition group-hover:rotate-45"><ArrowUpRight size={19}/></span></div><div className="pt-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.15em] text-[#81971d]">{venue.sport}</p><h3 className="mt-1 text-xl font-black tracking-tight">{venue.name}</h3></div><div className="flex items-center gap-1 pt-1 text-xs font-extrabold"><Star size={13} fill="#d6a927" stroke="#d6a927"/>{venue.rating || 'New'}<span className="font-medium text-black/35">({venue.reviews || 0})</span></div></div><p className="mt-2 flex items-center gap-1.5 text-sm text-black/50"><MapPin size={14}/>{venue.area}</p><div className="mt-4 flex items-end justify-between border-t border-black/10 pt-3"><div><span className="text-xl font-black">{money(venue.price)}</span><span className="text-xs text-black/45"> / hour</span></div><span className="text-xs font-bold">View court <ArrowRight className="ml-1 inline" size={14}/></span></div></div></article>;
}

function VenueModal({
  venue,
  date,
  setDate,
  time,
  setTime,
  onClose,
  onBookSuccess,
}: {
  venue: Venue;
  date: string;
  setDate: (v: string) => void;
  time: string;
  setTime: (v: string) => void;
  onClose: () => void;
  onBookSuccess: (booking: Booking) => void;
}) {
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [bookedCount, setBookedCount] = useState<number>(0);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const totalCourts = venue.total_courts || 1; // Fallback to 1 if not set in DB

  // Fetch how many bookings exist for this venue + date + time
  useEffect(() => {
    async function checkSlotCapacity() {
      if (!venue.id || !date || !time) return;
      setCheckingAvailability(true);

      const { count, error } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('venue_id', venue.id)
        .eq('booking_date', date)
        .eq('booking_time', time)
        .neq('status', 'Cancelled');

      if (!error && count !== null) {
        setBookedCount(count);
      }
      setCheckingAvailability(false);
    }

    checkSlotCapacity();
  }, [venue.id, date, time]);

  const isFullyBooked = bookedCount >= totalCourts;
  const isFormValid =
    date &&
    date >= dateLabel(today) &&
    venue.slots.includes(time) &&
    customerName.trim().length > 0 &&
    customerEmail.trim().length > 0 &&
    !isFullyBooked;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isFormValid || submitting) return;

    setSubmitting(true);
    setErrorMsg('');

    // Double check capacity right before inserting
    const { count } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('venue_id', venue.id)
      .eq('booking_date', date)
      .eq('booking_time', time)
      .neq('status', 'Cancelled');

    if (count !== null && count >= totalCourts) {
      setErrorMsg('Sorry! Someone just booked the last court for this time slot.');
      setBookedCount(count);
      setSubmitting(false);
      return;
    }

    const bookingCode = `MO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    const { error } = await supabase.from('bookings').insert([
      {
        booking_code: bookingCode,
        venue_id: venue.id,
        venue_name: venue.name,
        sport: venue.sport,
        booking_date: date,
        booking_time: time,
        price: venue.price,
        customer_name: customerName,
        customer_email: customerEmail,
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
      venue: venue.name,
      sport: venue.sport,
      date,
      time,
      price: venue.price,
      status: 'Confirmed',
    };

    setSubmitting(false);
    onBookSuccess(newBooking);
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white sm:rounded-3xl">
        <div className="relative h-52 sm:h-64">
          <img
            src={venue.image || DEFAULT_IMG}
            alt={venue.name}
            className="h-full w-full object-cover"
          />
          <button
            onClick={onClose}
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white text-black hover:bg-gray-100"
          >
            <X size={19} />
          </button>
          <span className="absolute bottom-4 left-4 rounded-full bg-[#d8ff3e] px-3 py-2 text-[10px] font-black tracking-widest text-black">
            {venue.sport.toUpperCase()}
          </span>
        </div>

        <div className="grid gap-7 p-5 sm:grid-cols-[1fr_.95fr] sm:p-8">
          {/* Venue Info */}
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

            <p className="mt-5 text-sm leading-6 text-black/60">
              {venue.description || 'No description provided.'}
            </p>

            <h3 className="mt-6 font-extrabold text-black">Court facilities</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {venue.facilities.map((f) => (
                <span
                  key={f}
                  className="rounded-full bg-[#f2f4ed] px-3 py-2 text-xs font-semibold text-black"
                >
                  {f}
                </span>
              ))}
            </div>

            <div className="mt-6 flex items-start gap-2 rounded-xl border border-[#e2e9c8] bg-[#f8fbeF] p-3 text-xs leading-5 text-black/60">
              <ShieldCheck size={17} className="shrink-0 text-[#72871b]" />
              Total Courts Available: <b className="text-black ml-1">{totalCourts}</b>
            </div>
          </div>

          {/* Booking & Details Form */}
          <form onSubmit={handleSubmit} className="rounded-2xl bg-[#f7f8f4] p-5 border border-black/10">
            <div className="flex items-end justify-between border-b border-black/10 pb-3">
              <h3 className="text-lg font-black text-black">Book a time</h3>
              <p className="text-black">
                <b className="text-xl">{money(venue.price)}</b>
                <span className="text-xs text-black/45">/hr</span>
              </p>
            </div>

            {/* Date Select */}
            <label className="mt-4 block text-xs font-bold text-black/55 uppercase">
              Select Date
              <input
                type="date"
                value={date}
                min={dateLabel(today)}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm font-semibold text-black outline-none focus:border-black/40"
              />
            </label>

            {/* Time Slot Select */}
            <p className="mt-4 text-xs font-bold text-black/55 uppercase">Available Slots</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {venue.slots.map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setTime(s)}
                  className={`rounded-xl border px-2 py-2.5 text-sm font-bold transition ${
                    time === s
                      ? 'border-[#101310] bg-[#101310] text-white'
                      : 'border-black/10 bg-white text-black hover:border-black/40'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Capacity Warning Banner */}
            <div className="mt-3 text-xs">
              {checkingAvailability ? (
                <p className="text-black/50">Checking slot availability...</p>
              ) : isFullyBooked ? (
                <p className="font-bold text-red-600 bg-red-50 p-2 rounded-lg border border-red-200">
                  ⚠️ Fully booked! ({bookedCount}/{totalCourts} courts taken at {time})
                </p>
              ) : (
                <p className="text-[#687e14] font-semibold">
                  ✓ {totalCourts - bookedCount} court(s) remaining for {time}
                </p>
              )}
            </div>

            {/* User Contact Details Inputs */}
            <div className="mt-4 border-t border-black/10 pt-4 space-y-3">
              <p className="text-xs font-extrabold text-black uppercase tracking-wider">Your Details</p>
              <label className="block text-xs font-bold text-black/60">
                Full Name *
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Tan"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black outline-none focus:border-black/40"
                />
              </label>

              <label className="block text-xs font-bold text-black/60">
                Email / Phone *
                <input
                  type="text"
                  required
                  placeholder="e.g. alex@example.com"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black outline-none focus:border-black/40"
                />
              </label>
            </div>

            {errorMsg && (
              <p className="mt-3 text-xs font-bold text-red-600">{errorMsg}</p>
            )}

            <div className="mt-4 flex items-center justify-between border-t border-black/10 pt-3 text-sm">
              <span className="text-black/55">1 hour total</span>
              <b className="text-lg text-black">{money(venue.price)}</b>
            </div>

            <button
              type="submit"
              disabled={!isFormValid || submitting}
              className="mt-4 w-full rounded-full bg-[#d8ff3e] px-5 py-3.5 text-sm font-black text-black transition hover:bg-[#c9f02e] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Confirming...' : 'Confirm booking'}
              {!submitting && <ArrowRight className="ml-2 inline" size={17} />}
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
  return <section className="mx-auto min-h-[75vh] max-w-7xl px-5 py-10 lg:px-8 lg:py-16"><button onClick={onBack} className="mb-7 flex items-center gap-2 text-sm font-bold text-black/55 hover:text-black"><ArrowLeft size={17}/> Back to discovery</button><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[.2em] text-[#81971d]">VENUE CONTROL CENTRE</p><h1 className="mt-3 text-4xl font-black tracking-[-.06em] sm:text-5xl">Your game plan.</h1><p className="mt-3 text-sm text-black/55">A preview of the tools venue owners will use to manage Motion.</p></div><span className="self-start rounded-full bg-[#d8ff3e] px-4 py-2 text-xs font-black">DEMO ADMIN</span></div><div className="mt-9 grid gap-4 sm:grid-cols-3">{[{label:'Listed venues',value:String(venues.length),sub:'Live Supabase records'},{label:'Active demo bookings',value:String(active.length),sub:'Created in this session'},{label:'Demo booking value',value:money(active.reduce((sum,b)=>sum+b.price,0)),sub:'Not real revenue'}].map(c=><div key={c.label} className="rounded-2xl border border-black/10 bg-white p-5"><p className="text-sm font-semibold text-black/50">{c.label}</p><p className="mt-4 text-3xl font-black tracking-tight">{c.value}</p><p className="mt-1 text-xs text-black/40">{c.sub}</p></div>)}</div><div className="mt-9 border-b border-black/10"><div className="flex gap-6">{(['Bookings','Venues'] as const).map(t=><button key={t} onClick={()=>setTab(t)} className={`border-b-2 px-1 pb-3 text-sm font-extrabold ${tab===t?'border-[#101310]':'border-transparent text-black/45'}`}>{t}</button>)}</div></div>{tab==='Bookings' ? <div className="mt-5 overflow-hidden rounded-2xl border border-black/10 bg-white"><div className="flex items-center justify-between border-b border-black/10 p-5"><h2 className="font-black">Recent bookings</h2><span className="text-xs text-black/45">This session only</span></div>{bookings.length ? <div className="divide-y divide-black/5">{bookings.map(b=><div key={b.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#f0f4e2]">{b.sport==='Badminton'?'🏸':b.sport==='Tennis'?'🎾':b.sport==='Basketball'?'🏀':'⚽'}</div><div className="flex-1"><p className="font-extrabold">{b.venue}</p><p className="mt-1 text-xs text-black/45">{b.date} · {b.time} · {b.id}</p></div><div className="flex items-center gap-3"><span className={`rounded-full px-3 py-1.5 text-[10px] font-black ${b.status==='Confirmed'?'bg-[#edf5d2] text-[#5d7112]':'bg-gray-100 text-gray-500'}`}>{b.status}</span><b className="min-w-16 text-right">{money(b.price)}</b>{b.status==='Confirmed'&&<button onClick={()=>onCancel(b.id)} className="text-xs font-bold text-red-600 underline">Cancel</button>}</div></div>)}</div> : <div className="p-12 text-center"><CalendarDays className="mx-auto text-black/25" size={30}/><p className="mt-3 font-extrabold">No demo bookings yet</p><p className="mt-1 text-sm text-black/45">Return to Explore and create a sample booking to see it here.</p><button onClick={onBack} className="mt-4 rounded-full bg-[#101310] px-5 py-3 text-sm font-bold text-white">Explore courts</button></div>}</div> : <div className="mt-5 overflow-hidden rounded-2xl border border-black/10 bg-white"><div className="border-b border-black/10 p-5"><h2 className="font-black">Venue listings</h2><p className="mt-1 text-xs text-black/45">Live database venues</p></div><div className="divide-y divide-black/5">{venues.map(v=><div key={v.id} className="flex items-center gap-4 p-4 sm:p-5"><img src={v.image || DEFAULT_IMG} alt="" className="h-14 w-16 rounded-xl object-cover sm:h-16 sm:w-20"/><div className="min-w-0 flex-1"><p className="truncate font-extrabold">{v.name}</p><p className="mt-1 text-xs text-black/45">{v.sport} · {v.area}</p></div><div className="text-right"><p className="font-black">{money(v.price)}<span className="text-xs font-medium text-black/40">/hr</span></p><p className="mt-1 text-[10px] font-bold text-[#718617]">DATABASE LISTING</p></div></div>)}</div><div className="border-t border-black/10 bg-[#f7f8f4] p-5"><p className="text-sm font-extrabold">Need to add a venue?</p><p className="mt-1 text-xs text-black/50">Venue creation forms and saved changes are part of the next build step.</p><button onClick={()=>setVenueMessage('Venue management forms are on the next milestone. These sample listings are read-only for now.')} className="mt-3 rounded-full bg-[#101310] px-4 py-2.5 text-xs font-bold text-white">+ Add venue</button>{venueMessage&&<p className="mt-3 text-xs font-semibold text-[#667a13]">{venueMessage}</p>}</div></div>}</section>;
}