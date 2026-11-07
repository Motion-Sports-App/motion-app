'use client';

import { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Building2,
  Calendar,
  Clock,
  DollarSign,
  Plus,
  Save,
  UserCheck,
  XCircle,
  CheckCircle2,
  Sliders,
} from 'lucide-react';
import type { Booking } from '@/lib/services/bookingService';
import type { Venue } from '@/lib/data';

const money = (n: number) => `฿${n.toLocaleString('en-US')}`;

const DEFAULT_HOURS = [
  '08:00', '09:00', '10:00', '11:00', '12:00', '13:00',
  '14:00', '15:00', '16:00', '17:00', '18:00', '19:00',
  '20:00', '21:00', '22:00'
];

export default function Dashboard({
  user,
  bookings,
  venues,
  onBack,
  onCancel,
}: {
  user: any;
  bookings: Booking[];
  venues: Venue[];
  onBack: () => void;
  onCancel: (id: string) => void;
}) {
  const [activeRole, setActiveRole] = useState<'venue' | 'coach'>('venue');
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [selectedVenueId, setSelectedVenueId] = useState<string>(
    venues[0]?.id || '1'
  );

  // Editable Venue Settings
  // Editable Venue Settings
  const selectedVenue = useMemo(
    () => venues.find((v) => v.id === selectedVenueId) || venues[0],
    [venues, selectedVenueId]
  );

  const [totalCourts, setTotalCourts] = useState<number>(
    selectedVenue?.total_courts || 6
  );
  const [openTime, setOpenTime] = useState('08:00');
  const [closeTime, setCloseTime] = useState('22:00');

  // Matrix override state: key format "date_courtIndex_time" -> false (blocked)
  const [blockedSlots, setBlockedSlots] = useState<Record<string, boolean>>({});

  // Stats Calculations
  const stats = useMemo(() => {
    const active = bookings.filter((b) => b.status === 'Confirmed');
    const cancelled = bookings.filter((b) => b.status === 'Cancelled');
    const totalRev = active.reduce((sum, b) => sum + b.price, 0);

    return {
      revenue: totalRev,
      activeCount: active.length,
      cancelCount: cancelled.length,
      listings: venues.length || 1,
    };
  }, [bookings, venues]);

  // Filter time slots based on open and close bounds
  const activeHours = useMemo(() => {
    const startHour = parseInt(openTime.split(':')[0], 10);
    const endHour = parseInt(closeTime.split(':')[0], 10);
    return DEFAULT_HOURS.filter((h) => {
      const hr = parseInt(h.split(':')[0], 10);
      return hr >= startHour && hr <= endHour;
    });
  }, [openTime, closeTime]);

  const toggleSlotStatus = (courtNum: number, time: string) => {
    const key = `${selectedDate}_C${courtNum}_${time}`;
    setBlockedSlots((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <section className="mx-auto min-h-[85vh] max-w-6xl px-5 py-10 lg:px-8 lg:py-16">
      {/* HEADER & ROLE SWITCHER */}
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-sm font-bold text-black/55 transition hover:text-black"
      >
        <ArrowLeft size={17} /> Back to main site
      </button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-black/10 pb-6">
        <div>
          <p className="text-xs font-black uppercase tracking-[.2em] text-[#81971d]">
            PARTNER DASHBOARD
          </p>
          <h1 className="mt-1 text-4xl font-black tracking-[-.06em]">Control Centre</h1>
          <p className="mt-1 text-sm text-black/55">
            Manage court reservations, active listings, and coaching schedules.
          </p>
        </div>

        {/* ROLE TOGGLE BUTTONS */}
        <div className="flex items-center rounded-2xl border border-black/10 bg-[#f7f8f4] p-1">
          <button
            onClick={() => setActiveRole('venue')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition ${
              activeRole === 'venue'
                ? 'bg-[#101310] text-[#d8ff3e] shadow-sm'
                : 'text-black/60 hover:text-black'
            }`}
          >
            <Building2 size={15} /> Venue Owner
          </button>
          <button
            onClick={() => setActiveRole('coach')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition ${
              activeRole === 'coach'
                ? 'bg-[#101310] text-[#d8ff3e] shadow-sm'
                : 'text-black/60 hover:text-black'
            }`}
          >
            <UserCheck size={15} /> Coach Portal
          </button>
        </div>
      </div>

      {/* METRICS STATS BAR */}
      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-black/45">
            <span>TOTAL REVENUE</span>
            <DollarSign size={18} className="text-[#81971d]" />
          </div>
          <p className="mt-2 text-3xl font-black">{money(stats.revenue)}</p>
        </div>

        <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-black/45">
            <span>ACTIVE BOOKINGS</span>
            <CheckCircle2 size={18} className="text-green-600" />
          </div>
          <p className="mt-2 text-3xl font-black">{stats.activeCount}</p>
        </div>

        <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-black/45">
            <span>CANCELLATIONS</span>
            <XCircle size={18} className="text-red-500" />
          </div>
          <p className="mt-2 text-3xl font-black">{stats.cancelCount}</p>
        </div>

        <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-black/45">
            <span>{activeRole === 'venue' ? 'VENUES LISTED' : 'CLIENT SESSIONS'}</span>
            <Building2 size={18} className="text-black/50" />
          </div>
          <p className="mt-2 text-3xl font-black">{stats.listings}</p>
        </div>
      </div>

      {/* VENUE SPECIFIC: TIMESLOT MATRIX & CONFIGURATION */}
      {activeRole === 'venue' && (
        <div className="mt-10 rounded-3xl border border-black/10 bg-white p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-black/10 pb-6">
            <div>
              <h2 className="text-2xl font-black tracking-tight">Court & Timeslot Matrix</h2>
              <p className="mt-1 text-xs text-black/50">
                Configure courts and block out hours for maintenance or private events.
              </p>
            </div>

            {/* DATE & VENUE CONFIG CONTROLS */}
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 rounded-xl border border-black/15 bg-[#f7f8f4] px-3 py-1.5 text-xs font-bold">
                <Calendar size={15} />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent outline-none"
                />
              </label>

              <div className="flex items-center gap-2 rounded-xl border border-black/15 bg-[#f7f8f4] px-3 py-1.5 text-xs font-bold">
                <Sliders size={15} />
                <span>Courts:</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={totalCourts}
                  onChange={(e) => setTotalCourts(Number(e.target.value))}
                  className="w-12 bg-white rounded border border-black/10 px-1 text-center font-bold"
                />
              </div>
            </div>
          </div>

          {/* HOURS RANGE SELECTOR */}
          <div className="mt-4 flex items-center gap-4 text-xs font-bold text-black/70">
            <div className="flex items-center gap-2">
              <Clock size={14} /> Operating Hours:
              <select
                value={openTime}
                onChange={(e) => setOpenTime(e.target.value)}
                className="rounded-lg border border-black/15 bg-white px-2 py-1"
              >
                {DEFAULT_HOURS.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              <span>to</span>
              <select
                value={closeTime}
                onChange={(e) => setCloseTime(e.target.value)}
                className="rounded-lg border border-black/15 bg-white px-2 py-1"
              >
                {DEFAULT_HOURS.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          </div>

          {/* TIMESLOT SPREADSHEET TABLE */}
          <div className="mt-6 overflow-x-auto rounded-2xl border border-black/10">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-[#101310] text-white text-xs font-black uppercase">
                  <th className="p-3 border-r border-white/10 w-28">Time</th>
                  {Array.from({ length: totalCourts }).map((_, i) => (
                    <th key={i} className="p-3 text-center border-r border-white/10">
                      Court {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10 text-xs">
                {activeHours.map((time) => (
                  <tr key={time} className="hover:bg-black/[0.02]">
                    <td className="p-3 font-extrabold bg-[#f7f8f4] border-r border-black/10">
                      {time}
                    </td>
                    {Array.from({ length: totalCourts }).map((_, i) => {
                      const isBlocked = blockedSlots[`${selectedDate}_C${i + 1}_${time}`];
                      return (
                        <td key={i} className="p-2 border-r border-black/10 text-center">
                          <button
                            onClick={() => toggleSlotStatus(i + 1, time)}
                            className={`w-full rounded-lg py-2 text-[11px] font-black transition ${
                              isBlocked
                                ? 'bg-red-100 text-red-600 border border-red-200 hover:bg-red-200'
                                : 'bg-[#eef7cf] text-[#556912] border border-[#d3ea8c] hover:bg-[#dff0a6]'
                            }`}
                          >
                            {isBlocked ? 'BLOCKED' : 'AVAILABLE'}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MASTER RESERVATIONS LIST */}
      <div className="mt-10 rounded-3xl border border-black/10 bg-white p-6 sm:p-8 shadow-sm">
        <h2 className="text-2xl font-black tracking-tight">Master Reservation List</h2>
        <p className="mt-1 text-xs text-black/50">
          Showing active player bookings associated with your account.
        </p>

        <div className="mt-6 divide-y divide-black/10 rounded-2xl border border-black/10">
          {bookings.length > 0 ? (
            bookings.map((b) => (
              <div
                key={b.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center justify-between"
              >
                <div>
                  <span className="text-[10px] font-black uppercase text-[#81971d]">
                    {b.sport} · Ref: <span className="font-mono">{b.id}</span>
                  </span>
                  <p className="font-extrabold text-base text-black mt-0.5">{b.venue}</p>
                  <p className="text-xs text-black/50">
                    {b.date} · {b.time}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-3 py-1 text-[10px] font-black ${
                      b.status === 'Cancelled'
                        ? 'bg-red-100 text-red-600'
                        : 'bg-[#edf5d2] text-[#5d7112]'
                    }`}
                  >
                    {b.status}
                  </span>
                  <b className="text-sm">{money(b.price)}</b>
                  {b.status === 'Confirmed' && (
                    <button
                      onClick={() => onCancel(b.id)}
                      className="text-xs font-bold text-red-600 underline hover:text-red-800 transition"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-xs font-bold text-black/45">
              No active reservations found for this view.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}