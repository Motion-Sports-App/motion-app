'use client';

import { useState } from 'react';
import { ArrowLeft, CalendarDays } from 'lucide-react';
import { DEFAULT_VENUE_IMAGE } from '@/lib/constants';
import type { Booking } from '@/lib/services/bookingService';
import type { Venue } from '@/lib/data';

const money = (n: number) => `฿${n.toLocaleString('en-US')}`;

export default function Dashboard({
  bookings,
  venues,
  onBack,
  onCancel,
}: {
  bookings: Booking[];
  venues: Venue[];
  onBack: () => void;
  onCancel: (id: string) => void;
}) {
  const [tab, setTab] = useState<'Bookings' | 'Venues'>('Bookings');
  const [venueMessage, setVenueMessage] = useState('');
  const active = bookings.filter((b) => b.status === 'Confirmed');

  return (
    <section className="mx-auto min-h-[75vh] max-w-7xl px-5 py-10 lg:px-8 lg:py-16">
      <button onClick={onBack} className="mb-7 flex items-center gap-2 text-sm font-bold text-black/55 hover:text-black">
        <ArrowLeft size={17} /> Back to discovery
      </button>

      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[.2em] text-[#81971d]">VENUE CONTROL CENTRE</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-.06em] sm:text-5xl">Your game plan.</h1>
          <p className="mt-3 text-sm text-black/55">A preview of the tools venue owners will use to manage Motion.</p>
        </div>
        <span className="self-start rounded-full bg-[#d8ff3e] px-4 py-2 text-xs font-black">APPROVED VENUE</span>
      </div>

      <div className="mt-9 grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Listed venues', value: String(venues.length), sub: 'Live Supabase records' },
          { label: 'Active demo bookings', value: String(active.length), sub: 'Created in this session' },
          { label: 'Demo booking value', value: money(active.reduce((sum, b) => sum + b.price, 0)), sub: 'Not real revenue' },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-black/10 bg-white p-5">
            <p className="text-sm font-semibold text-black/50">{c.label}</p>
            <p className="mt-4 text-3xl font-black tracking-tight">{c.value}</p>
            <p className="mt-1 text-xs text-black/40">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-9 border-b border-black/10">
        <div className="flex gap-6">
          {(['Bookings', 'Venues'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`border-b-2 px-1 pb-3 text-sm font-extrabold ${
                tab === t ? 'border-[#101310]' : 'border-transparent text-black/45'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {tab === 'Bookings' ? (
        <div className="mt-5 overflow-hidden rounded-2xl border border-black/10 bg-white">
          <div className="flex items-center justify-between border-b border-black/10 p-5">
            <h2 className="font-black">Recent bookings</h2>
            <span className="text-xs text-black/45">This session only</span>
          </div>
          {bookings.length ? (
            <div className="divide-y divide-black/5">
              {bookings.map((b) => (
                <div key={b.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#f0f4e2]">
                    {b.sport === 'Badminton' ? '🏸' : b.sport === 'Tennis' ? '🎾' : b.sport === 'Basketball' ? '🏀' : '⚽'}
                  </div>
                  <div className="flex-1">
                    <p className="font-extrabold">{b.venue}</p>
                    <p className="mt-1 text-xs text-black/45">{b.date} · {b.time} · {b.id}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-3 py-1.5 text-[10px] font-black ${b.status === 'Confirmed' ? 'bg-[#edf5d2] text-[#5d7112]' : 'bg-gray-100 text-gray-500'}`}>
                      {b.status}
                    </span>
                    <b className="min-w-16 text-right">{money(b.price)}</b>
                    {b.status === 'Confirmed' && (
                      <button onClick={() => onCancel(b.id)} className="text-xs font-bold text-red-600 underline">
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <CalendarDays className="mx-auto text-black/25" size={30} />
              <p className="mt-3 font-extrabold">No demo bookings yet</p>
              <p className="mt-1 text-sm text-black/45">Return to Explore and create a sample booking to see it here.</p>
              <button onClick={onBack} className="mt-4 rounded-full bg-[#101310] px-5 py-3 text-sm font-bold text-white">
                Explore courts
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-5 overflow-hidden rounded-2xl border border-black/10 bg-white">
          <div className="border-b border-black/10 p-5">
            <h2 className="font-black">Venue listings</h2>
            <p className="mt-1 text-xs text-black/45">Live database venues</p>
          </div>
          <div className="divide-y divide-black/5">
            {venues.map((v) => (
              <div key={v.id} className="flex items-center gap-4 p-4 sm:p-5">
                <img src={v.image || DEFAULT_VENUE_IMAGE} alt="" className="h-14 w-16 rounded-xl object-cover sm:h-16 sm:w-20" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-extrabold">{v.name}</p>
                  <p className="mt-1 text-xs text-black/45">{v.sport} · {v.area}</p>
                </div>
                <div className="text-right">
                  <p className="font-black">{money(v.price)}<span className="text-xs font-medium text-black/40">/hr</span></p>
                  <p className="mt-1 text-[10px] font-bold text-[#718617]">DATABASE LISTING</p>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-black/10 bg-[#f7f8f4] p-5">
            <p className="text-sm font-extrabold">Need to add a venue?</p>
            <p className="mt-1 text-xs text-black/50">Venue creation forms and saved changes are part of the next build step.</p>
            <button
              onClick={() => setVenueMessage('Venue management forms are on the next milestone. These sample listings are read-only for now.')}
              className="mt-3 rounded-full bg-[#101310] px-4 py-2.5 text-xs font-bold text-white"
            >
              + Add venue
            </button>
            {venueMessage && <p className="mt-3 text-xs font-semibold text-[#667a13]">{venueMessage}</p>}
          </div>
        </div>
      )}
    </section>
  );
}