'use client';

import { useState, useMemo } from 'react';
import { ArrowLeft, CalendarDays, CheckCircle2, History, ChevronDown } from 'lucide-react';
import type { Booking } from '@/lib/services/bookingService';

const money = (n: number) => `฿${n.toLocaleString('en-US')}`;

function isBookingPast(dateStr: string, timeStr: string): boolean {
  try {
    const now = new Date();

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
  
  // State to track visible past bookings (starts at 5)
  const [pastLimit, setPastLimit] = useState(5);

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

  // Slice list if in "past" tab according to current pastLimit
  const displayedList =
    activeTab === 'upcoming' ? upcomingBookings : pastBookings.slice(0, pastLimit);

  const hasMorePast = activeTab === 'past' && pastLimit < pastBookings.length;

  return (
    <section className="mx-auto min-h-[75vh] max-w-4xl px-5 py-10 lg:px-8 lg:py-16">
      <button
        onClick={onBack}
        className="mb-7 flex items-center gap-2 text-sm font-bold text-black/55 dark:text-[#F7F8F4]/60 hover:text-black dark:hover:text-[#F7F8F4] transition"
      >
        <ArrowLeft size={17} /> Back to discovery
      </button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[.2em] text-[#81971d] dark:text-[#d8ff3e]">PLAYER ACCOUNT</p>
          <h1 className="mt-1 text-4xl font-black tracking-[-.06em] text-[#101310] dark:text-[#F7F8F4]">My Bookings</h1>
          <p className="mt-1 text-sm text-black/55 dark:text-[#F7F8F4]/60">Manage your active reservations and game history.</p>
        </div>
        {user && (
          <span className="self-start sm:self-auto rounded-full bg-[#eef7cf] dark:bg-[#d8ff3e]/15 px-4 py-2 text-xs font-black text-[#586c12] dark:text-[#d8ff3e] border border-[#d2e896] dark:border-[#d8ff3e]/30">
            ⚡ Points: {totalPoints} PTS
          </span>
        )}
      </div>

      {/* TABS */}
      <div className="mt-8 flex gap-3 border-b border-black/10 dark:border-white/10 pb-3">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition ${
            activeTab === 'upcoming'
              ? 'bg-[#101310] dark:bg-[#d8ff3e] text-[#d8ff3e] dark:text-[#101310] shadow-sm'
              : 'bg-white dark:bg-[#16171A] text-black/60 dark:text-[#F7F8F4]/70 hover:bg-black/5 dark:hover:bg-white/10 border border-black/10 dark:border-white/10'
          }`}
        >
          <CheckCircle2 size={15} />
          Upcoming & Ongoing ({upcomingBookings.length})
        </button>

        <button
          onClick={() => {
            setActiveTab('past');
            setPastLimit(5); // Reset limit back to 5 when switching tabs
          }}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition ${
            activeTab === 'past'
              ? 'bg-[#101310] dark:bg-[#d8ff3e] text-[#d8ff3e] dark:text-[#101310] shadow-sm'
              : 'bg-white dark:bg-[#16171A] text-black/60 dark:text-[#F7F8F4]/70 hover:bg-black/5 dark:hover:bg-white/10 border border-black/10 dark:border-white/10'
          }`}
        >
          <History size={15} />
          Past & Cancelled
        </button>
      </div>

      {/* BOOKINGS LIST */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#16171A]">
        {displayedList.length > 0 ? (
          <>
            <div className="divide-y divide-black/5 dark:divide-white/10">
              {displayedList.map((b) => {
                const isPast = isBookingPast(b.date, b.time);
                const isCancelled = b.status === 'Cancelled';

                return (
                  <div key={b.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-[#81971d] dark:text-[#d8ff3e]">
                          {b.sport}
                        </span>
                        {isPast && !isCancelled && (
                          <span className="rounded-full bg-gray-100 dark:bg-white/10 px-2 py-0.5 text-[9px] font-bold text-gray-500 dark:text-[#F7F8F4]/60">
                            Completed
                          </span>
                        )}
                      </div>
                      <p className="font-extrabold text-base text-[#101310] dark:text-[#F7F8F4] mt-0.5">{b.venue}</p>
                      <p className="mt-1 text-xs text-black/50 dark:text-[#F7F8F4]/60">
                        {b.date} · {b.time} · Ref: <span className="font-mono">{b.id}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full px-3 py-1 text-[10px] font-black ${
                          isCancelled
                            ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'
                            : isPast
                            ? 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-[#F7F8F4]/70'
                            : 'bg-[#edf5d2] dark:bg-[#d8ff3e]/20 text-[#5d7112] dark:text-[#d8ff3e]'
                        }`}
                      >
                        {isCancelled ? 'Cancelled' : isPast ? 'Completed' : 'Confirmed'}
                      </span>
                      <b className="text-sm text-[#101310] dark:text-[#F7F8F4]">{money(b.price)}</b>

                      {b.status === 'Confirmed' && !isPast && (
                        <button
                          onClick={() => onCancel(b.id)}
                          className="text-xs font-bold text-red-600 dark:text-red-400 underline ml-2 hover:text-red-800 dark:hover:text-red-300 transition"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* LOAD MORE BUTTON */}
            {hasMorePast && (
              <div className="p-4 text-center border-t border-black/5 dark:border-white/10 bg-[#f7f8f4] dark:bg-[#0B0B0C]">
                <button
                  onClick={() => setPastLimit((prev) => prev + 5)}
                  className="inline-flex items-center gap-2 rounded-full border border-black/15 dark:border-white/10 bg-white dark:bg-[#16171A] px-5 py-2 text-xs font-bold text-[#101310] dark:text-[#F7F8F4] transition hover:bg-black/5 dark:hover:bg-white/10"
                >
                  Load More <ChevronDown size={14} />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="p-12 text-center">
            <CalendarDays className="mx-auto text-black/25 dark:text-[#F7F8F4]/30" size={32} />
            <p className="mt-3 font-extrabold text-lg text-[#101310] dark:text-[#F7F8F4]">
              {activeTab === 'upcoming' ? 'No upcoming bookings' : 'No past bookings'}
            </p>
            <p className="mt-1 text-sm text-black/45 dark:text-[#F7F8F4]/60">
              {activeTab === 'upcoming'
                ? 'Explore available courts and lock in your next session!'
                : 'Your completed or cancelled reservations will show up here.'}
            </p>
            {activeTab === 'upcoming' && (
              <button
                onClick={onBack}
                className="mt-5 rounded-full bg-[#101310] dark:bg-[#d8ff3e] px-6 py-3 text-xs font-bold text-white dark:text-[#101310] hover:bg-[#30372a] dark:hover:bg-[#c9f02e] transition"
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