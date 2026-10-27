'use client';

import { useState, useMemo } from 'react';
import { ArrowLeft, CalendarDays, CheckCircle2, History } from 'lucide-react';
import type { Booking } from '@/lib/services/bookingService';

const money = (n: number) => `฿${n.toLocaleString('en-US')}`;

// Helper to determine if a booking date + time slot has already passed
function isBookingPast(dateStr: string, timeStr: string): boolean {
  try {
    const now = new Date();

    // Find the last slot end time (e.g. from "11:00 - 12:00, 12:00 - 13:00", get "13:00")
    let endTimeStr = '23:59';
    const parts = timeStr.split(',');
    const lastPart = parts[parts.length - 1].trim();

    if (lastPart.includes('-')) {
      endTimeStr = lastPart.split('-')[1].trim().split(' ')[0];
    } else if (lastPart.includes('–')) {
      endTimeStr = lastPart.split('–')[1].trim().split(' ')[0];
    }

    const [hours, minutes] = endTimeStr.split(':').map(Number);
    const bookingEndTime = new Date(dateStr);
    bookingEndTime.setHours(hours || 23, minutes || 59, 0, 0);

    return now > bookingEndTime;
  } catch (err) {
    return false;
  }
}

export default function UserBookingsView({
  user,
  bookings,
  onBack,
  onCancel,
}: {
  user: any;
  bookings: Booking[];
  onBack: () => void;
  onCancel: (id: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');

  const { upcomingBookings, pastBookings, totalPoints } = useMemo(() => {
    const upcoming: Booking[] = [];
    const past: Booking[] = [];
    let points = 0;

    bookings.forEach((b) => {
      if (b.status === 'Confirmed') {
        points += b.pointsEarned || 0;
      }

      const isPast = isBookingPast(b.date, b.time);

      if (b.status === 'Cancelled' || isPast) {
        past.push(b);
      } else {
        upcoming.push(b);
      }
    });

    return { upcomingBookings: upcoming, pastBookings: past, totalPoints: points };
  }, [bookings]);

  const currentList = activeTab === 'upcoming' ? upcomingBookings : pastBookings;

  return (
    <section className="mx-auto min-h-[75vh] max-w-4xl px-5 py-10 lg:px-8 lg:py-16">
      <button
        onClick={onBack}
        className="mb-7 flex items-center gap-2 text-sm font-bold text-black/55 hover:text-black transition"
      >
        <ArrowLeft size={17} /> Back to discovery
      </button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[.2em] text-[#81971d]">PLAYER ACCOUNT</p>
          <h1 className="mt-1 text-4xl font-black tracking-[-.06em]">My Bookings</h1>
          <p className="mt-1 text-sm text-black/55">Manage your active reservations and game history.</p>
        </div>
        {user && (
          <span className="self-start sm:self-auto rounded-full bg-[#eef7cf] px-4 py-2 text-xs font-black text-[#586c12] border border-[#d2e896]">
            ⚡ Points Earned: {totalPoints} PTS
          </span>
        )}
      </div>

      {/* TABS */}
      <div className="mt-8 flex gap-3 border-b border-black/10 pb-3">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition ${
            activeTab === 'upcoming'
              ? 'bg-[#101310] text-[#d8ff3e] shadow-sm'
              : 'bg-white text-black/60 hover:bg-black/5 border border-black/10'
          }`}
        >
          <CheckCircle2 size={15} />
          Upcoming & Ongoing ({upcomingBookings.length})
        </button>

        <button
          onClick={() => setActiveTab('past')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition ${
            activeTab === 'past'
              ? 'bg-[#101310] text-[#d8ff3e] shadow-sm'
              : 'bg-white text-black/60 hover:bg-black/5 border border-black/10'
          }`}
        >
          <History size={15} />
          Past & Cancelled ({pastBookings.length})
        </button>
      </div>

      {/* BOOKINGS LIST */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-black/10 bg-white">
        {currentList.length > 0 ? (
          <div className="divide-y divide-black/5">
            {currentList.map((b) => {
              const isPast = isBookingPast(b.date, b.time);
              const isCancelled = b.status === 'Cancelled';

              return (
                <div key={b.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-[#81971d]">
                        {b.sport}
                      </span>
                      {isPast && !isCancelled && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-bold text-gray-500">
                          Completed
                        </span>
                      )}
                    </div>
                    <p className="font-extrabold text-base text-black mt-0.5">{b.venue}</p>
                    <p className="mt-1 text-xs text-black/50">
                      {b.date} · {b.time} · Ref: <span className="font-mono">{b.id}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-3 py-1 text-[10px] font-black ${
                        isCancelled
                          ? 'bg-red-100 text-red-600'
                          : isPast
                          ? 'bg-gray-100 text-gray-600'
                          : 'bg-[#edf5d2] text-[#5d7112]'
                      }`}
                    >
                      {isCancelled ? 'Cancelled' : isPast ? 'Completed' : 'Confirmed'}
                    </span>
                    <b className="text-sm">{money(b.price)}</b>

                    {b.status === 'Confirmed' && !isPast && (
                      <button
                        onClick={() => onCancel(b.id)}
                        className="text-xs font-bold text-red-600 underline ml-2 hover:text-red-800 transition"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center">
            <CalendarDays className="mx-auto text-black/25" size={32} />
            <p className="mt-3 font-extrabold text-lg">
              {activeTab === 'upcoming' ? 'No upcoming bookings' : 'No past bookings'}
            </p>
            <p className="mt-1 text-sm text-black/45">
              {activeTab === 'upcoming'
                ? 'Explore available courts and lock in your next session!'
                : 'Your completed or cancelled reservations will show up here.'}
            </p>
            {activeTab === 'upcoming' && (
              <button
                onClick={onBack}
                className="mt-5 rounded-full bg-[#101310] px-6 py-3 text-xs font-bold text-white hover:bg-[#30372a] transition"
              >
                Find a court
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}