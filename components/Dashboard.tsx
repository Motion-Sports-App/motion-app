'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft,
  Building2,
  Calendar,
  Clock,
  DollarSign,
  UserCheck,
  XCircle,
  CheckCircle2,
  Sliders,
  Edit2,
  Check,
  Loader2,
} from 'lucide-react';
import { partnerService } from '@/lib/services/partnerService';
import type { Booking } from '@/lib/services/bookingService';
import type { Venue, OperatingHours } from '@/lib/data';

const money = (n: number) => `฿${n.toLocaleString('en-US')}`;

const DEFAULT_HOURS = [
  '00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00',
  '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00',
  '14:00', '15:00', '16:00', '17:00', '18:00', '19:00',
  '20:00', '21:00', '22:00', '23:00', '24:00'
];

export default function Dashboard({
  user,
  bookings,
  venues,
  onBack,
  onCancel,
  onVenueUpdate,
}: {
  user: any;
  bookings: Booking[];
  venues: Venue[];
  onBack: () => void;
  onCancel: (id: string) => void;
  onVenueUpdate?: (updatedVenue: Venue) => void;
}) {
  const [activeRole, setActiveRole] = useState<'venue' | 'coach'>('venue');
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [selectedVenueId, setSelectedVenueId] = useState<string>('');

  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const selectedVenue = useMemo(() => {
    if (!venues || venues.length === 0) return null;
    return (
      venues.find((v) => v.id === selectedVenueId) ||
      venues.find((v) => v.user_id === user?.id || v.owner_id === user?.id) ||
      venues[0]
    );
  }, [venues, selectedVenueId, user]);

  const [totalCourts, setTotalCourts] = useState<number>(1);
  const [openTime, setOpenTime] = useState<string>('08:00');
  const [closeTime, setCloseTime] = useState<string>('22:00');
  const [blockedSlots, setBlockedSlots] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (selectedVenue) {
      const courtCount = selectedVenue.total_courts ?? 1;
      setTotalCourts(Number(courtCount) > 0 ? Number(courtCount) : 1);

      let parsedHours: OperatingHours | null = null;
      const rawHours = selectedVenue.operating_hours;

      if (typeof rawHours === 'string') {
        try {
          parsedHours = JSON.parse(rawHours);
        } catch {
          parsedHours = null;
        }
      } else if (rawHours && typeof rawHours === 'object') {
        parsedHours = rawHours as OperatingHours;
      }

      setOpenTime(parsedHours?.open_time || '08:00');
      setCloseTime(parsedHours?.close_time || '22:00');
    }
  }, [selectedVenue]);

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

  const activeHours = useMemo(() => {
    const startHour = parseInt(openTime.split(':')[0], 10) || 8;
    const endHour = parseInt(closeTime.split(':')[0], 10) || 22;
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

  const handleSaveConfig = async () => {
    if (!selectedVenue?.id) {
      alert('No venue selected to update.');
      return;
    }

    setIsSaving(true);
    try {
      const matrixPayload = {
        total_courts: Number(totalCourts),
        operating_hours: {
          open_time: openTime,
          close_time: closeTime,
          slot_duration_minutes: 60,
        },
      };

      const res = await partnerService.updateVenueMatrix(selectedVenue.id, matrixPayload);

      if (res.success) {
        const dbRecord = Array.isArray(res.data) ? res.data[0] : res.data;

        // Clean merge preserving existing fields like facilities & slots
        const mergedVenue: Venue = {
          ...selectedVenue,
          facilities: selectedVenue.facilities || [],
          slots: selectedVenue.slots || [],
          ...matrixPayload,
          ...(dbRecord || {}),
        };

        if (onVenueUpdate) {
          onVenueUpdate(mergedVenue);
        }
        setIsEditingConfig(false);
      } else {
        alert(`Supabase save error: ${res.error}`);
      }
    } catch (err: any) {
      console.error('Failed to update venue configuration:', err);
      alert(`Save error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="mx-auto min-h-[85vh] max-w-6xl px-5 py-10 lg:px-8 lg:py-16">
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
            Managing <span className="font-bold text-black">{selectedVenue?.name || 'Venue'}</span>
          </p>
        </div>

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

      {activeRole === 'venue' && (
        <div className="mt-10 rounded-3xl border border-black/10 bg-white p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-black/10 pb-6">
            <div>
              <h2 className="text-2xl font-black tracking-tight">Court & Timeslot Matrix</h2>
              <p className="mt-1 text-xs text-black/50">
                Click slots to toggle status. White represents available, Red represents blocked/taken.
              </p>
            </div>

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

              <button
                onClick={() => {
                  if (isEditingConfig) {
                    handleSaveConfig();
                  } else {
                    setIsEditingConfig(true);
                  }
                }}
                disabled={isSaving}
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold transition ${
                  isEditingConfig
                    ? 'bg-[#d8ff3e] text-black border border-black/20 hover:bg-[#cbf528]'
                    : 'bg-[#101310] text-white hover:bg-black/80'
                }`}
              >
                {isSaving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : isEditingConfig ? (
                  <>
                    <Check size={14} /> Save Config
                  </>
                ) : (
                  <>
                    <Edit2 size={14} /> Edit Settings
                  </>
                )}
              </button>
            </div>
          </div>

          <div className={`mt-4 flex flex-wrap items-center gap-6 rounded-2xl p-3 text-xs font-bold transition ${
            isEditingConfig ? 'bg-[#f0f7db] border border-[#d0e588]' : 'bg-[#f7f8f4]'
          }`}>
            <div className="flex items-center gap-2">
              <Sliders size={15} className="text-black/50" />
              <span>Courts Count:</span>
              <input
                type="number"
                min={1}
                max={50}
                disabled={!isEditingConfig}
                value={totalCourts}
                onChange={(e) => setTotalCourts(Math.max(1, Number(e.target.value)))}
                className={`w-16 rounded border px-2 py-1 text-center font-bold outline-none ${
                  isEditingConfig
                    ? 'bg-white border-black/30 ring-2 ring-[#81971d]/40'
                    : 'bg-black/5 border-transparent text-black/60 cursor-not-allowed'
                }`}
              />
            </div>

            <div className="flex items-center gap-2">
              <Clock size={15} className="text-black/50" />
              <span>Operating Hours:</span>
              <select
                disabled={!isEditingConfig}
                value={openTime}
                onChange={(e) => setOpenTime(e.target.value)}
                className={`rounded-lg border px-2 py-1 outline-none ${
                  isEditingConfig
                    ? 'bg-white border-black/30'
                    : 'bg-black/5 border-transparent text-black/60 cursor-not-allowed'
                }`}
              >
                {DEFAULT_HOURS.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              <span>to</span>
              <select
                disabled={!isEditingConfig}
                value={closeTime}
                onChange={(e) => setCloseTime(e.target.value)}
                className={`rounded-lg border px-2 py-1 outline-none ${
                  isEditingConfig
                    ? 'bg-white border-black/30'
                    : 'bg-black/5 border-transparent text-black/60 cursor-not-allowed'
                }`}
              >
                {DEFAULT_HOURS.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          </div>

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
                  <tr key={time} className="hover:bg-black/[0.01]">
                    <td className="p-3 font-extrabold bg-[#f7f8f4] border-r border-black/10">
                      {time}
                    </td>
                    {Array.from({ length: totalCourts }).map((_, i) => {
                      const isBlocked = blockedSlots[`${selectedDate}_C${i + 1}_${time}`];
                      return (
                        <td key={i} className="p-1.5 border-r border-black/10 text-center">
                          <button
                            onClick={() => toggleSlotStatus(i + 1, time)}
                            title={isBlocked ? 'Blocked / Taken' : 'Available'}
                            className={`h-9 w-full rounded-xl border transition shadow-2xs ${
                              isBlocked
                                ? 'bg-red-500 border-red-600 hover:bg-red-600'
                                : 'bg-white border-black/15 hover:bg-[#eef7cf]'
                            }`}
                          />
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