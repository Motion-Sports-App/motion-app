'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
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
  BarChart3,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  PlusCircle,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { partnerService } from '@/lib/services/partnerService';
import { bookingService, type Booking } from '@/lib/services/bookingService';
import type { Venue, OperatingHours } from '@/lib/data';
import { money } from '@/lib/constants';

type DashboardBooking = Booking & {
  customerName?: string;
  customerEmail?: string;
  courtCount?: number;
};

const DEFAULT_HOURS = [
  '00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00',
  '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00',
  '14:00', '15:00', '16:00', '17:00', '18:00', '19:00',
  '20:00', '21:00', '22:00', '23:00'
];

const getLocalTodayStr = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// Format "08:00" -> "08:00 - 09:00" to stay compatible with ALL_BOOKING_SLOTS in bookingService
const toFullSlotLabel = (startHourStr: string) => {
  const hr = parseInt(startHourStr.split(':')[0], 10);
  const nextHr = (hr + 1) % 24;
  return `${String(hr).padStart(2, '0')}:00 - ${String(nextHr).padStart(2, '0')}:00`;
};

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
  onBack?: () => void;
  onCancel: (id: string) => void;
  onVenueUpdate?: (updatedVenue: Venue) => void;
}) {
  const [activeRole, setActiveRole] = useState<'venue' | 'coach'>('venue');
  const [selectedDate, setSelectedDate] = useState<string>(() => getLocalTodayStr());
  const [selectedVenueId, setSelectedVenueId] = useState<string>('');

  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showVenueStats, setShowVenueStats] = useState(false);

  // Front-Desk "Book Court" Mode States
  const [isBookingMode, setIsBookingMode] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState<
    { court: number; time: string }[]
  >([]);
  const [walkInName, setWalkInName] = useState('');
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);

  // Live venue bookings mapped from Supabase `bookings` columns
  const [venueBookings, setVenueBookings] = useState<DashboardBooking[]>(
    bookings || []
  );

  const isSuperAdmin = useMemo(() => {
    return Boolean(
      user?.email &&
        ['mingtan0403@gmail.com', 'motionsportsapp@gmail.com'].includes(
          user.email.toLowerCase()
        )
    );
  }, [user]);

  const ownedVenues = useMemo(() => {
    if (!venues || venues.length === 0) return [];
    if (isSuperAdmin) return venues;
    if (!user?.id) return [];
    return venues.filter((v) => v.user_id === user.id || v.owner_id === user.id);
  }, [venues, user, isSuperAdmin]);

  const selectedVenue = useMemo(() => {
    if (ownedVenues.length === 0) return null;
    return ownedVenues.find((v) => v.id === selectedVenueId) || ownedVenues[0];
  }, [ownedVenues, selectedVenueId]);

  const fetchVenueBookings = useCallback(async () => {
    if (!selectedVenue?.id && !selectedVenue?.name) return;

    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      const venueRows = data.filter((b: any) => {
        if (b.venue_id && selectedVenue.id) {
          return String(b.venue_id) === String(selectedVenue.id);
        }
        return (
          String(b.venue_name || '').trim().toLowerCase() ===
          String(selectedVenue.name || '').trim().toLowerCase()
        );
      });

      const mapped: DashboardBooking[] = venueRows.map((b: any) => ({
        id: b.booking_code || String(b.id),
        dbId: String(b.id),
        venue: b.venue_name || selectedVenue.name || 'Court Booking',
        sport: b.sport || selectedVenue.sport || 'Sports',
        date: b.booking_date || b.date,
        time: b.time_slot || b.booking_time || '',
        price: Number(b.total_amount ?? b.price ?? 0),
        status:
          String(b.status || '').toLowerCase() === 'cancelled'
            ? 'Cancelled'
            : 'Confirmed',
        pointsEarned: b.points_earned || 0,
        customerName: b.customer_name || '',
        customerEmail: b.customer_email || '',
        courtCount: Number(b.court_count || 1),
      }));
      setVenueBookings(mapped);
    } else if (error) {
      console.error('Error fetching venue bookings:', error);
    }
  }, [selectedVenue?.id, selectedVenue?.name, selectedVenue?.sport]);

  useEffect(() => {
    fetchVenueBookings();
  }, [fetchVenueBookings]);

  const [totalCourts, setTotalCourts] = useState<number>(1);
  const [openTime, setOpenTime] = useState<string>('08:00');
  const [closeTime, setCloseTime] = useState<string>('22:00');

  useEffect(() => {
    let currentDay = getLocalTodayStr();
    const interval = setInterval(() => {
      const latestDay = getLocalTodayStr();
      if (latestDay !== currentDay) {
        setSelectedDate((prev) => (prev === currentDay ? latestDay : prev));
        currentDay = latestDay;
      }
    }, 60_000);

    return () => clearInterval(interval);
  }, []);

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

  const activeHours = useMemo(() => {
    const startHour = parseInt(openTime.split(':')[0], 10);
    const rawEndHour = parseInt(closeTime.split(':')[0], 10);
    const safeStart = isNaN(startHour) ? 8 : startHour;
    const safeEnd = isNaN(rawEndHour) ? 22 : rawEndHour === 0 ? 24 : rawEndHour;

    return DEFAULT_HOURS.filter((h) => {
      const hr = parseInt(h.split(':')[0], 10);
      return hr >= safeStart && hr < safeEnd;
    });
  }, [openTime, closeTime]);

  // Map confirmed bookings on selectedDate onto specific (Court, Time) cells
  const bookedCellMap = useMemo(() => {
    const map: Record<string, DashboardBooking> = {};
    const activeOnDate = venueBookings.filter(
      (b) => b.status === 'Confirmed' && b.date === selectedDate
    );

    const fallbackUsedByTime: Record<string, number> = {};

    activeOnDate.forEach((b) => {
      const rawTime = String(b.time || '');
      const timeMatch = rawTime.match(/\d{2}:\d{2}/);
      const slotTime = timeMatch ? timeMatch[0] : rawTime;

      // Support both "Court 2" and "Courts 1, 2"
      const courtListMatch = rawTime.match(/Courts?\s*([\d,\s]+)/i);
      const explicitCourts = courtListMatch
        ? courtListMatch[1]
            .split(',')
            .map((n) => parseInt(n.trim(), 10))
            .filter((n) => !isNaN(n) && n >= 1 && n <= totalCourts)
        : [];

      if (explicitCourts.length > 0) {
        explicitCourts.forEach((c) => {
          map[`C${c}_${slotTime}`] = b;
        });
      } else {
        const qty = Math.max(1, Number(b.courtCount || 1));
        for (let q = 0; q < qty; q++) {
          let assignedCourt = (fallbackUsedByTime[slotTime] || 0) + 1;
          while (
            map[`C${assignedCourt}_${slotTime}`] &&
            assignedCourt <= totalCourts
          ) {
            assignedCourt++;
          }
          if (assignedCourt <= totalCourts) {
            fallbackUsedByTime[slotTime] = assignedCourt;
            map[`C${assignedCourt}_${slotTime}`] = b;
          }
        }
      }
    });

    return map;
  }, [venueBookings, selectedDate, totalCourts]);

  const stats = useMemo(() => {
    const active = venueBookings.filter((b) => b.status === 'Confirmed');
    const cancelled = venueBookings.filter((b) => b.status === 'Cancelled');
    const totalRev = active.reduce((sum, b) => sum + Number(b.price || 0), 0);

    const totalDailySlots = totalCourts * Math.max(activeHours.length, 1);
    const bookedTodayCount = Object.keys(bookedCellMap).length;
    const occupancyRate =
      totalDailySlots > 0
        ? Math.min(100, Math.round((bookedTodayCount / totalDailySlots) * 100))
        : 0;

    return {
      revenue: totalRev,
      activeCount: active.length,
      cancelCount: cancelled.length,
      listings: ownedVenues.length,
      occupancyRate,
    };
  }, [venueBookings, ownedVenues, totalCourts, activeHours, bookedCellMap]);

  const handleCellClick = async (courtNum: number, time: string) => {
    const cellKey = `C${courtNum}_${time}`;
    const existingBooking = bookedCellMap[cellKey];

    if (existingBooking) {
      if (isBookingMode) return;
      const guestLabel =
        existingBooking.customerName ||
        existingBooking.customerEmail ||
        'Walk-in';
      const confirmRelease = window.confirm(
        `Court ${courtNum} at ${time} is booked by ${guestLabel}. Cancel and release this slot?`
      );
      if (confirmRelease) {
        await handleCancelReservation(existingBooking);
      }
      return;
    }

    if (isBookingMode) {
      setSelectedSlots((prev) => {
        const exists = prev.some((s) => s.court === courtNum && s.time === time);
        if (exists) {
          return prev.filter((s) => !(s.court === courtNum && s.time === time));
        }
        return [...prev, { court: courtNum, time }];
      });
    }
  };

  const handleConfirmFrontDeskBooking = async () => {
    if (!selectedVenue || selectedSlots.length === 0) return;

    setIsSubmittingBooking(true);
    try {
      const hourlyPrice = Number(
        selectedVenue.price_per_hour ?? selectedVenue.price ?? 0
      );
      const guestName = walkInName.trim() || 'Walk-in Player';
      const frontDeskEmail = user?.email || 'frontdesk@motion.app';

      // Create each selected slot via bookingService.createViaRPC so `create_court_booking` handles capacity & booking_code
      const results = await Promise.all(
        selectedSlots.map((slot) =>
          bookingService.createViaRPC({
            venueId: selectedVenue.id,
            venueName: selectedVenue.name,
            sport: selectedVenue.sport || 'Badminton',
            date: selectedDate,
            timeSlot: `${toFullSlotLabel(slot.time)} · Court ${slot.court}`,
            courtCount: 1,
            totalPrice: hourlyPrice,
            customerName: `${guestName} (Front Desk)`,
            customerEmail: frontDeskEmail,
            totalCourts: Number(totalCourts),
          })
        )
      );

      const failed = results.find((r) => !r.success);
      if (failed) {
        throw new Error(failed.error || 'One or more slots failed to book.');
      }

      await fetchVenueBookings();
      setSelectedSlots([]);
      setWalkInName('');
      setIsBookingMode(false);
    } catch (err: any) {
      console.error('Front-desk booking error:', err);
      alert(`Failed to create booking: ${err.message}`);
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  const handleCancelReservation = async (booking: DashboardBooking) => {
    const targetId = booking.dbId || booking.id;

    // Optimistically release the slot in the matrix immediately
    setVenueBookings((prev) =>
      prev.map((b) =>
        (b.dbId || b.id) === targetId ? { ...b, status: 'Cancelled' } : b
      )
    );

    const ok = await bookingService.cancel(targetId);
    if (!ok) {
      alert(
        'Could not cancel booking in Supabase. Please make sure your bookings UPDATE policy allows venue owners to update bookings.'
      );
      await fetchVenueBookings();
      return;
    }

    if (onCancel) {
      onCancel(booking.id);
    }
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

      const res = await partnerService.updateVenueMatrix(
        selectedVenue.id,
        matrixPayload
      );

      if (res.success) {
        const dbRecord = Array.isArray(res.data) ? res.data[0] : res.data;

        const mergedVenue: Venue = {
          ...selectedVenue,
          price:
            selectedVenue.price ??
            dbRecord?.price ??
            dbRecord?.price_per_hour ??
            0,
          price_per_hour:
            selectedVenue.price_per_hour ??
            dbRecord?.price_per_hour ??
            selectedVenue.price ??
            0,
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

  const hourlyRate = Number(
    selectedVenue?.price_per_hour ?? selectedVenue?.price ?? 0
  );
  const totalSelectedAmount = selectedSlots.length * hourlyRate;

  return (
    <section className="mx-auto min-h-[85vh] max-w-6xl px-5 py-6 lg:px-8 lg:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-black/10 pb-4">
        <p className="text-xs font-black uppercase tracking-[.2em] text-[#81971d]">
          {activeRole === 'venue'
            ? `${selectedVenue?.name || 'Venue'} Control Centre`
            : 'Coach Control Centre'}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          {activeRole === 'venue' && ownedVenues.length > 1 && (
            <select
              value={selectedVenue?.id || ''}
              onChange={(e) => {
                setSelectedVenueId(e.target.value);
                setIsEditingConfig(false);
                setIsBookingMode(false);
                setSelectedSlots([]);
              }}
              className="rounded-xl border border-black/15 bg-white px-3 py-2 text-xs font-bold outline-none"
            >
              {ownedVenues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          )}

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
      </div>

      {activeRole === 'venue' &&
        (selectedVenue ? (
          <>
            {/* COMPACT COURT & TIMESLOT MATRIX */}
            <div className="mt-5 rounded-3xl border border-black/10 bg-white p-5 sm:p-6 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-black/10 pb-4">
                <div>
                  <h2 className="text-xl font-black tracking-tight">
                    Court & Timeslot Matrix
                  </h2>
                  <p className="mt-0.5 text-xs text-black/50">
                    {isBookingMode
                      ? 'Select one or more open white slots below, then confirm to book.'
                      : 'White = Available · Red = Booked (click a red slot to cancel).'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <label className="flex items-center gap-2 rounded-xl border border-black/15 bg-[#f7f8f4] px-3 py-1.5 text-xs font-bold">
                    <Calendar size={15} />
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => {
                        setSelectedDate(e.target.value);
                        setSelectedSlots([]);
                      }}
                      className="bg-transparent outline-none"
                    />
                  </label>

                  {/* BOOK COURT BUTTON */}
                  <button
                    type="button"
                    onClick={() => {
                      if (isEditingConfig) setIsEditingConfig(false);
                      setIsBookingMode((prev) => {
                        if (prev) setSelectedSlots([]);
                        return !prev;
                      });
                    }}
                    className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold transition ${
                      isBookingMode
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'bg-[#d8ff3e] text-black border border-black/15 hover:bg-[#cbf528]'
                    }`}
                  >
                    {isBookingMode ? (
                      <>
                        <X size={14} /> Cancel Selection
                      </>
                    ) : (
                      <>
                        <PlusCircle size={14} /> Book Court
                      </>
                    )}
                  </button>

                  {/* EDIT SETTINGS BUTTON */}
                  <button
                    type="button"
                    onClick={() => {
                      if (isBookingMode) {
                        setIsBookingMode(false);
                        setSelectedSlots([]);
                      }
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

              {/* FRONT-DESK BOOKING CHECKOUT BAR */}
              {isBookingMode && (
                <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-[#81971d]/40 bg-[#f0f7db] p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <span className="rounded-lg bg-[#101310] px-2.5 py-1 font-black text-[#d8ff3e]">
                      {selectedSlots.length}{' '}
                      {selectedSlots.length === 1 ? 'Slot' : 'Slots'} Selected
                    </span>
                    <span className="font-extrabold text-black">
                      Total: {money(totalSelectedAmount)}
                    </span>
                    <input
                      type="text"
                      value={walkInName}
                      onChange={(e) => setWalkInName(e.target.value)}
                      placeholder="Player name / phone (optional)"
                      className="rounded-lg border border-black/15 bg-white px-3 py-1.5 text-xs font-medium outline-none w-52"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={selectedSlots.length === 0 || isSubmittingBooking}
                    onClick={handleConfirmFrontDeskBooking}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-[#101310] px-5 py-2 text-xs font-black text-[#d8ff3e] transition hover:bg-black/85 disabled:opacity-40"
                  >
                    {isSubmittingBooking ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Booking...
                      </>
                    ) : (
                      <>
                        <Check size={14} /> Confirm & Book ({selectedSlots.length})
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* COURTS & HOURS CONFIG BAR */}
              {!isBookingMode && (
                <div
                  className={`mt-3 flex flex-wrap items-center gap-6 rounded-xl px-3 py-2 text-xs font-bold transition ${
                    isEditingConfig
                      ? 'bg-[#f0f7db] border border-[#d0e588]'
                      : 'bg-[#f7f8f4]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Sliders size={14} className="text-black/50" />
                    <span>Courts Count:</span>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      disabled={!isEditingConfig}
                      value={totalCourts}
                      onChange={(e) =>
                        setTotalCourts(Math.max(1, Number(e.target.value)))
                      }
                      className={`w-14 rounded border px-2 py-0.5 text-center font-bold outline-none ${
                        isEditingConfig
                          ? 'bg-white border-black/30 ring-2 ring-[#81971d]/40'
                          : 'bg-black/5 border-transparent text-black/60 cursor-not-allowed'
                      }`}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-black/50" />
                    <span>Operating Hours:</span>
                    <select
                      disabled={!isEditingConfig}
                      value={openTime}
                      onChange={(e) => setOpenTime(e.target.value)}
                      className={`rounded-lg border px-2 py-0.5 outline-none ${
                        isEditingConfig
                          ? 'bg-white border-black/30'
                          : 'bg-black/5 border-transparent text-black/60 cursor-not-allowed'
                      }`}
                    >
                      {DEFAULT_HOURS.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                    <span>to</span>
                    <select
                      disabled={!isEditingConfig}
                      value={closeTime}
                      onChange={(e) => setCloseTime(e.target.value)}
                      className={`rounded-lg border px-2 py-0.5 outline-none ${
                        isEditingConfig
                          ? 'bg-white border-black/30'
                          : 'bg-black/5 border-transparent text-black/60 cursor-not-allowed'
                      }`}
                    >
                      {DEFAULT_HOURS.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* MATRIX TABLE */}
              <div className="mt-4 overflow-x-auto rounded-xl border border-black/15">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-[#101310] text-white text-[11px] font-black uppercase">
                      <th className="px-3 py-2 border-r border-white/10 w-24">
                        Time
                      </th>
                      {Array.from({ length: totalCourts }).map((_, i) => (
                        <th
                          key={i}
                          className="px-2 py-2 text-center border-r border-white/10 last:border-r-0"
                        >
                          Court {i + 1}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/10 text-xs">
                    {activeHours.map((time) => (
                      <tr key={time}>
                        <td className="px-3 py-1 font-extrabold bg-[#f7f8f4] border-r border-black/10">
                          {time}
                        </td>
                        {Array.from({ length: totalCourts }).map((_, i) => {
                          const courtNum = i + 1;
                          const booking = bookedCellMap[`C${courtNum}_${time}`];
                          const isBooked = Boolean(booking);
                          const isSelected = selectedSlots.some(
                            (s) => s.court === courtNum && s.time === time
                          );
                          const guestName =
                            booking?.customerName ||
                            booking?.customerEmail ||
                            'Walk-in';

                          return (
                            <td
                              key={i}
                              className="p-0 border-r border-black/10 last:border-r-0"
                            >
                              <button
                                type="button"
                                onClick={() => handleCellClick(courtNum, time)}
                                title={
                                  isBooked
                                    ? `Booked (${guestName})`
                                    : isBookingMode
                                    ? isSelected
                                      ? 'Selected — click to unselect'
                                      : 'Click to select slot'
                                    : 'Available (click "Book Court" to book)'
                                }
                                className={`flex h-7 w-full items-center justify-center text-[10px] font-black transition-colors ${
                                  isBooked
                                    ? 'bg-red-500 text-white hover:bg-red-600'
                                    : isSelected
                                    ? 'bg-[#d8ff3e] text-black ring-1 ring-inset ring-black/40'
                                    : isBookingMode
                                    ? 'bg-white hover:bg-[#eef7cf] cursor-pointer'
                                    : 'bg-white cursor-default'
                                }`}
                              >
                                {isSelected && '✓'}
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

            {/* COLLAPSIBLE VENUE STATISTICS */}
            <div className="mt-5">
              <button
                type="button"
                onClick={() => setShowVenueStats((prev) => !prev)}
                className="flex w-full items-center justify-between rounded-2xl border border-black/10 bg-white px-6 py-4 text-left shadow-sm transition hover:border-black/25"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#eef7cf] text-[#586c12]">
                    <BarChart3 size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-black">
                      {showVenueStats
                        ? 'Hide Venue Statistics'
                        : 'View More Venue Statistics'}
                    </p>
                    <p className="text-xs text-black/50">
                      Revenue, bookings breakdown, cancellations & court
                      utilization
                    </p>
                  </div>
                </div>
                {showVenueStats ? (
                  <ChevronUp size={18} className="text-black/60" />
                ) : (
                  <ChevronDown size={18} className="text-black/60" />
                )}
              </button>

              {showVenueStats && (
                <div
                  className={`mt-4 grid grid-cols-2 gap-4 ${
                    isSuperAdmin ? 'lg:grid-cols-5' : 'lg:grid-cols-4'
                  }`}
                >
                  <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-black/45">
                      <span>TOTAL REVENUE</span>
                      <DollarSign size={18} className="text-[#81971d]" />
                    </div>
                    <p className="mt-2 text-3xl font-black">
                      {money(stats.revenue)}
                    </p>
                  </div>

                  <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-black/45">
                      <span>ACTIVE BOOKINGS</span>
                      <CheckCircle2 size={18} className="text-green-600" />
                    </div>
                    <p className="mt-2 text-3xl font-black">
                      {stats.activeCount}
                    </p>
                  </div>

                  <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-black/45">
                      <span>CANCELLATIONS</span>
                      <XCircle size={18} className="text-red-500" />
                    </div>
                    <p className="mt-2 text-3xl font-black">
                      {stats.cancelCount}
                    </p>
                  </div>

                  <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-black/45">
                      <span>UTILIZATION ({selectedDate})</span>
                      <TrendingUp size={18} className="text-[#81971d]" />
                    </div>
                    <p className="mt-2 text-3xl font-black">
                      {stats.occupancyRate}%
                    </p>
                  </div>

                  {isSuperAdmin && (
                    <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
                      <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-black/45">
                        <span>VENUES LISTED</span>
                        <Building2 size={18} className="text-black/50" />
                      </div>
                      <p className="mt-2 text-3xl font-black">
                        {stats.listings}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="mt-8 rounded-3xl border border-dashed border-black/20 bg-white p-12 text-center">
            <h2 className="text-xl font-black">No active venue found</h2>
            <p className="mt-2 text-xs text-black/55">
              This account is no longer linked to an active venue listing.
            </p>
          </div>
        ))}

      {activeRole === 'coach' && (
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
          <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-black/45">
              <span>COACHING REVENUE</span>
              <DollarSign size={18} className="text-[#81971d]" />
            </div>
            <p className="mt-2 text-3xl font-black">{money(stats.revenue)}</p>
          </div>

          <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-black/45">
              <span>CLIENT SESSIONS</span>
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
        </div>
      )}

      <div className="mt-8 rounded-3xl border border-black/10 bg-white p-6 sm:p-8 shadow-sm">
        <h2 className="text-2xl font-black tracking-tight">
          Master Reservation List
        </h2>
        <p className="mt-1 text-xs text-black/50">
          Showing active player bookings for{' '}
          {selectedVenue?.name || 'your venue'}.
        </p>

        <div className="mt-6 divide-y divide-black/10 rounded-2xl border border-black/10">
          {venueBookings.length > 0 ? (
            venueBookings.map((b) => (
              <div
                key={b.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center justify-between"
              >
                <div>
                  <span className="text-[10px] font-black uppercase text-[#81971d]">
                    {b.sport} · Ref: <span className="font-mono">{b.id}</span>
                  </span>
                  <p className="font-extrabold text-base text-black mt-0.5">
                    {b.venue}{' '}
                    {(b.customerName || b.customerEmail) && (
                      <span className="text-xs font-semibold text-black/50">
                        ({b.customerName || b.customerEmail})
                      </span>
                    )}
                  </p>
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
                      onClick={() => handleCancelReservation(b)}
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