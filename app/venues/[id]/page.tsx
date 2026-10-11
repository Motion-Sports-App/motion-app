'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, MapPin, ShieldCheck, Star, Zap } from 'lucide-react';
import { type Venue } from '@/lib/data';
import { supabase } from '@/lib/supabase';

const money = (n: number) => `฿${n.toLocaleString('en-US')}`;
const today = new Date();
const dateLabel = (d: Date) => d.toLocaleDateString('en-CA');
const DEFAULT_IMG = "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=800&q=80";

type Booking = { id: string; venue: string; sport: string; date: string; time: string; price: number };

export default function VenueDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [venue, setVenue] = useState<Venue | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(dateLabel(today));
  const [selectedTime, setSelectedTime] = useState('18:00');
  const [confirmed, setConfirmed] = useState<Booking | null>(null);

  useEffect(() => {
    async function fetchVenue() {
      if (!id) return;
      setLoading(true);

      const { data, error } = await supabase
        .from('venues')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching venue from Supabase:', error);
      } else if (data) {
        const normalized: Venue = {
          ...data,
          price: Number(data.price ?? data.price_per_hour ?? 0),
          image: data.image || data.image_url || DEFAULT_IMG,
          facilities: Array.isArray(data.facilities) ? data.facilities : [],
          slots: Array.isArray(data.slots) ? data.slots : ['09:00', '10:00', '14:00', '18:00', '19:00'],
          area: data.area || 'Bangkok',
          sport: data.sport || 'Sports',
        };
        setVenue(normalized);
        if (normalized.slots.length > 0) {
          setSelectedTime(normalized.slots.includes('18:00') ? '18:00' : normalized.slots[0]);
        }
      }
      setLoading(false);
    }

    fetchVenue();
  }, [id]);

  function handleBooking() {
    if (!venue) return;
    const booking: Booking = {
      id: `MO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      venue: venue.name,
      sport: venue.sport,
      date: selectedDate,
      time: selectedTime,
      price: venue.price,
    };
    setConfirmed(booking);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f8f4]">
        <p className="text-sm font-bold text-black/50">Loading venue details...</p>
      </main>
    );
  }

  if (!venue) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#f7f8f4] p-5">
        <h1 className="text-2xl font-black">Court not found</h1>
        <p className="mt-2 text-sm text-black/50">The venue you are looking for does not exist or was removed.</p>
        <button
          onClick={() => router.push('/')}
          className="mt-6 rounded-full bg-[#101310] px-6 py-3 text-sm font-bold text-white"
        >
          Back to discovery
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8f4] pb-16">
      {/* Header */}
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-sm font-bold text-black/60 hover:text-black"
          >
            <ArrowLeft size={18} /> Back to discovery
          </button>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#101310] text-[#d8ff3e]">
              <Zap size={18} fill="currentColor" />
            </span>
            <span className="text-xl font-black tracking-[-.08em]">motion.</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="mx-auto mt-8 max-w-6xl px-5 lg:px-8">
        <div className="overflow-hidden rounded-3xl bg-white shadow-sm border border-black/10">
          {/* Hero Banner */}
          <div className="relative h-64 sm:h-80 md:h-96 w-full bg-[#e8ebdf]">
            <img
              src={venue.image}
              alt={venue.name}
              className="h-full w-full object-cover"
            />
            <span className="absolute bottom-5 left-5 rounded-full bg-[#d8ff3e] px-4 py-2 text-xs font-black tracking-widest">
              {venue.sport.toUpperCase()}
            </span>
          </div>

          {/* Details & Booking Grid */}
          <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_.85fr]">
            {/* Left: Info */}
            <div>
              <p className="flex items-center gap-1.5 text-xs font-bold text-black/50">
                <MapPin size={15} /> {venue.area}
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{venue.name}</h1>
              
              <div className="mt-3 flex items-center gap-2 text-sm font-extrabold">
                <Star size={16} fill="#d6a927" stroke="#d6a927" />
                <span>{venue.rating || 'New'}</span>
                <span className="font-medium text-black/40">({venue.reviews || 0} reviews)</span>
              </div>

              <p className="mt-6 text-sm leading-7 text-black/65">
                {venue.description || 'No description provided for this venue.'}
              </p>

              {venue.facilities.length > 0 && (
                <>
                  <h3 className="mt-8 font-extrabold text-sm uppercase tracking-wider text-black/50">Court Facilities</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {venue.facilities.map((facility) => (
                      <span
                        key={facility}
                        className="rounded-full bg-[#f2f4ed] px-3.5 py-2 text-xs font-semibold"
                      >
                        {facility}
                      </span>
                    ))}
                  </div>
                </>
              )}

              <div className="mt-8 flex items-start gap-2.5 rounded-2xl border border-[#e2e9c8] bg-[#f8fbeF] p-4 text-xs leading-5 text-black/60">
                <ShieldCheck size={18} className="shrink-0 text-[#72871b]" />
                Live Supabase listing. Session bookings created here are for testing purposes.
              </div>
            </div>

            {/* Right: Booking Form */}
            <div className="rounded-2xl border border-black/10 bg-[#f7f8f4] p-6">
              <div className="flex items-end justify-between border-b border-black/10 pb-4">
                <h2 className="text-lg font-black">Book a court</h2>
                <p>
                  <b className="text-2xl font-black">{money(venue.price)}</b>
                  <span className="text-xs text-black/45"> / hour</span>
                </p>
              </div>

              <label className="mt-5 block text-xs font-black uppercase tracking-wider text-black/55">
                Select Date
                <input
                  type="date"
                  value={selectedDate}
                  min={dateLabel(today)}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3.5 py-3 text-sm font-semibold outline-none focus:border-black/40"
                />
              </label>

              <p className="mt-5 text-xs font-black uppercase tracking-wider text-black/55">Available Slots</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {venue.slots.map((slot) => (
                  <button
                    key={slot}
                    onClick={() => setSelectedTime(slot)}
                    className={`rounded-xl border px-2 py-3 text-sm font-bold transition ${
                      selectedTime === slot
                        ? 'border-[#101310] bg-[#101310] text-white'
                        : 'border-black/10 bg-white hover:border-black/40'
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-black/10 pt-4 text-sm">
                <span className="text-black/55">1 hour total</span>
                <b className="text-xl font-black">{money(venue.price)}</b>
              </div>

              <button
                onClick={handleBooking}
                disabled={!selectedDate || selectedDate < dateLabel(today) || !venue.slots.includes(selectedTime)}
                className="mt-5 w-full rounded-full bg-[#d8ff3e] px-5 py-4 text-sm font-black transition hover:bg-[#c9f02e] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Confirm Booking <ArrowRight className="ml-2 inline" size={17} />
              </button>

              <p className="mt-3 text-center text-[10px] text-black/40">
                Instant confirmation. No deposit required.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Booking Confirmation Modal */}
      {confirmed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-3xl bg-white p-7 sm:p-9">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#d8ff3e]">
              <Check size={30} strokeWidth={3} />
            </div>
            <p className="mt-6 text-xs font-black uppercase tracking-[.2em] text-[#81971d]">BOOKING CREATED</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight">You're in. Game on!</h2>
            <p className="mt-2 text-sm leading-6 text-black/55">Your court time is confirmed for this demo session.</p>

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
                  <p className="mt-1 font-bold">
                    {confirmed.time}–{String(Number(confirmed.time.slice(0, 2)) + 1).padStart(2, '0')}:00
                  </p>
                </div>
              </div>
              <div className="mt-4 flex justify-between border-t border-black/10 pt-3 text-sm">
                <span className="text-black/50">Total</span>
                <span className="font-black">{money(confirmed.price)}</span>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => router.push('/')}
                className="flex-1 rounded-full bg-[#101310] px-4 py-3 text-sm font-bold text-white"
              >
                Back to Home
              </button>
              <button
                onClick={() => setConfirmed(null)}
                className="rounded-full border border-black/15 px-4 py-3 text-sm font-bold"
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