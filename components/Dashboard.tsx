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
  ArrowRightLeft,
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
  userId?: string | null;
};

type SelectedBookedCell = {
  key: string;
  court: number;
  time: string;
  booking: DashboardBooking;
};

const DEFAULT_HOURS = [
  '00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00',
  '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00',
  '14:00', '15:00', '16:00', '17:00', '18:00', '19:00',
  '20:00', '21:00', '22:00', '23:00',
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

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function Dashboard({
  user,
  bookings,
  venues,
  hasActiveCoach = false,
  onBack,
  onCancel,
  onVenueUpdate,
}: {
  user: any;
  bookings: Booking[];
  venues: Venue[];
  hasActiveCoach?: boolean;
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

  // Front-Desk "Book Court" Mode States (for selecting open white slots)
  const [isBookingMode, setIsBookingMode] = useState(false);

  // Swap Courts Mode States (Select Set A -> Select Set B -> Confirm Swap)
  const [isSwapMode, setIsSwapMode] = useState(false);
  const [swapStep, setSwapStep] = useState<'A' | 'B'>('A');
  const [swapSetA, setSwapSetA] = useState<SelectedBookedCell[]>([]);
  const [swapSetB, setSwapSetB] = useState<SelectedBookedCell[]>([]);
  const [isSwapping, setIsSwapping] = useState(false);

  const [selectedSlots, setSelectedSlots] = useState<
    { court: number; time: string }[]
  >([]);
  const [walkInName, setWalkInName] = useState('');
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);

  // Multi-select state for red/booked slots (for bulk cancel or moving courts)
  const [selectedBookedCells, setSelectedBookedCells] = useState<
    SelectedBookedCell[]
  >([]);
  const [targetMoveCourt, setTargetMoveCourt] = useState<number>(1);
  const [isProcessingBookedAction, setIsProcessingBookedAction] = useState(false);

  // Live venue bookings mapped from Supabase `bookings` columns
  const [venueBookings, setVenueBookings] = useState<DashboardBooking[]>(
    bookings || []
  );

  const isSuperAdmin = useMemo(() => {
    return Boolean(
      user?.email &&
        [
          'darylhsu45@gmail.com',
          'mingtan0403@gmail.com',
          'motionsportsapp@gmail.com',
          'kvorakijkamjorn@gmail.com',
        ].includes(user.email.toLowerCase())
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

  const [isApprovedCoach, setIsApprovedCoach] = useState<boolean>(hasActiveCoach);

  useEffect(() => {
    setIsApprovedCoach(hasActiveCoach);
  }, [hasActiveCoach]);

  useEffect(() => {
    if (!user?.id) {
      setIsApprovedCoach(false);
      return;
    }
    partnerService.getUserApplicationStatuses(user.id).then(({ coachStatus }) => {
      setIsApprovedCoach(coachStatus === 'approved');
    });
  }, [user?.id]);

  const hasVenueAccess = isSuperAdmin || ownedVenues.length > 0;
  const hasCoachAccess = isSuperAdmin || isApprovedCoach;
  const hasBothRoles = hasVenueAccess && hasCoachAccess;

  useEffect(() => {
    if (hasVenueAccess && !hasCoachAccess) {
      setActiveRole('venue');
    } else if (!hasVenueAccess && hasCoachAccess) {
      setActiveRole('coach');
    }
  }, [hasVenueAccess, hasCoachAccess]);

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
        userId: b.user_id || null,
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

  const handleOpenTimeChange = (newOpen: string) => {
    setOpenTime(newOpen);
    const newOpenHr = parseInt(newOpen.split(':')[0], 10);
    const currentCloseHr = parseInt(closeTime.split(':')[0], 10);
    if (closeTime !== '00:00' && currentCloseHr <= newOpenHr) {
      const nextValidClose =
        newOpenHr + 1 >= 24 ? '00:00' : `${String(newOpenHr + 1).padStart(2, '0')}:00`;
      setCloseTime(nextValidClose);
    }
  };

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

  // Determine which courts are conflict-free across all currently selected booked slots
  const validMoveCourts = useMemo(() => {
    if (selectedBookedCells.length === 0) return [];
    const selectedKeys = new Set(selectedBookedCells.map((c) => c.key));

    const available: number[] = [];
    for (let c = 1; c <= totalCourts; c++) {
      const hasConflict = selectedBookedCells.some((cell) => {
        const targetKey = `C${c}_${cell.time}`;
        return Boolean(bookedCellMap[targetKey]) && !selectedKeys.has(targetKey);
      });
      if (!hasConflict) {
        available.push(c);
      }
    }
    return available;
  }, [selectedBookedCells, totalCourts, bookedCellMap]);

  useEffect(() => {
    if (validMoveCourts.length > 0 && !validMoveCourts.includes(targetMoveCourt)) {
      const differentCourt = validMoveCourts.find(
        (c) => !selectedBookedCells.every((cell) => cell.court === c)
      );
      setTargetMoveCourt(differentCourt ?? validMoveCourts[0]);
    }
  }, [validMoveCourts, targetMoveCourt, selectedBookedCells]);

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

  const resetSwapMode = () => {
    setIsSwapMode(false);
    setSwapStep('A');
    setSwapSetA([]);
    setSwapSetB([]);
  };

  const handleCellClick = (courtNum: number, time: string) => {
    const cellKey = `C${courtNum}_${time}`;
    const existingBooking = bookedCellMap[cellKey];

    // SWAP MODE: Select Set A booked slots, then Set B booked slots
    if (isSwapMode) {
      if (!existingBooking) return;

      if (swapStep === 'A') {
        setSwapSetA((prev) => {
          const exists = prev.some((c) => c.key === cellKey);
          if (exists) return prev.filter((c) => c.key !== cellKey);
          return [
            ...prev,
            { key: cellKey, court: courtNum, time, booking: existingBooking },
          ];
        });
      } else {
        // Prevent picking a slot already in Set A
        if (swapSetA.some((c) => c.key === cellKey)) return;

        setSwapSetB((prev) => {
          const exists = prev.some((c) => c.key === cellKey);
          if (exists) return prev.filter((c) => c.key !== cellKey);
          if (prev.length >= swapSetA.length) return prev;
          return [
            ...prev,
            { key: cellKey, court: courtNum, time, booking: existingBooking },
          ];
        });
      }
      return;
    }

    // Clicking a red/booked slot toggles selection instead of opening an immediate popup
    if (existingBooking) {
      if (isBookingMode) {
        setIsBookingMode(false);
        setSelectedSlots([]);
      }
      setSelectedBookedCells((prev) => {
        const exists = prev.some((c) => c.key === cellKey);
        if (exists) {
          return prev.filter((c) => c.key !== cellKey);
        }
        return [
          ...prev,
          { key: cellKey, court: courtNum, time, booking: existingBooking },
        ];
      });
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

  const handleBulkCancelSelected = async () => {
    if (selectedBookedCells.length === 0) return;

    const uniqueBookings = Array.from(
      new Map(
        selectedBookedCells.map((c) => [c.booking.dbId || c.booking.id, c.booking])
      ).values()
    );

    setIsProcessingBookedAction(true);
    try {
      const targetIds = new Set(uniqueBookings.map((b) => b.dbId || b.id));

      setVenueBookings((prev) =>
        prev.map((b) =>
          targetIds.has(b.dbId || b.id) ? { ...b, status: 'Cancelled' } : b
        )
      );

      const results = await Promise.all(
        uniqueBookings.map((b) => bookingService.cancel(b.dbId || b.id))
      );

      if (results.some((ok) => !ok)) {
        alert(
          'One or more bookings could not be cancelled in Supabase. Check your bookings UPDATE policy.'
        );
      } else if (onCancel) {
        uniqueBookings.forEach((b) => onCancel(b.id));
      }

      setSelectedBookedCells([]);
      await fetchVenueBookings();
    } finally {
      setIsProcessingBookedAction(false);
    }
  };

  const handleMoveSelectedToCourt = async () => {
    if (selectedBookedCells.length === 0 || !selectedVenue) return;

    setIsProcessingBookedAction(true);
    try {
      const cellsByBooking = new Map<string, SelectedBookedCell[]>();
      selectedBookedCells.forEach((cell) => {
        const bKey = cell.booking.dbId || cell.booking.id;
        const arr = cellsByBooking.get(bKey) || [];
        arr.push(cell);
        cellsByBooking.set(bKey, arr);
      });

      for (const [, cells] of cellsByBooking.entries()) {
        const booking = cells[0].booking;
        const rawTime = String(booking.time || '');
        const slotRange =
          rawTime.match(/\d{2}:\d{2}\s*[-–]\s*\d{2}:\d{2}/)?.[0] ||
          toFullSlotLabel(cells[0].time);

        const courtListMatch = rawTime.match(/Courts?\s*([\d,\s]+)/i);
        const existingCourts = courtListMatch
          ? courtListMatch[1]
              .split(',')
              .map((n) => parseInt(n.trim(), 10))
              .filter((n) => !isNaN(n))
          : Array.from(
              { length: Math.max(1, Number(booking.courtCount || 1)) },
              (_, idx) => idx + 1
            );

        const movedFromCourts = new Set(cells.map((c) => c.court));
        const remainingCourts = existingCourts.filter(
          (c) => !movedFromCourts.has(c)
        );

        const updateFilter =
          booking.dbId && (UUID_REGEX.test(booking.dbId) || /^\d+$/.test(booking.dbId))
            ? { col: 'id', val: booking.dbId }
            : { col: 'booking_code', val: booking.id };

        if (remainingCourts.length === 0) {
          const newLabel = `${slotRange} · Court ${targetMoveCourt}`;
          const { data: updatedRows, error } = await supabase
            .from('bookings')
            .update({
              time_slot: newLabel,
              booking_time: newLabel,
            })
            .eq(updateFilter.col, updateFilter.val)
            .select('id');

          if (error) throw error;
          if (!updatedRows || updatedRows.length === 0) {
            throw new Error(
              'Database permission (RLS) blocked updating this player booking.'
            );
          }
        } else {
          const remainingLabel =
            remainingCourts.length === 1
              ? `${slotRange} · Court ${remainingCourts[0]}`
              : `${slotRange} · Courts ${remainingCourts.join(', ')}`;

          const unitPrice =
            existingCourts.length > 0
              ? Number(booking.price || 0) / existingCourts.length
              : Number(booking.price || 0);
          const remainingPrice = Math.round(unitPrice * remainingCourts.length * 100) / 100;
          const movedPrice = Math.round(unitPrice * cells.length * 100) / 100;

          const { data: updatedRows, error: updateErr } = await supabase
            .from('bookings')
            .update({
              time_slot: remainingLabel,
              booking_time: remainingLabel,
              court_count: remainingCourts.length,
              price: remainingPrice,
              total_amount: remainingPrice,
            })
            .eq(updateFilter.col, updateFilter.val)
            .select('id');

          if (updateErr) throw updateErr;
          if (!updatedRows || updatedRows.length === 0) {
            throw new Error(
              'Database permission (RLS) blocked updating this player booking.'
            );
          }

          const newCode = `MTN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
          const { error: insertErr } = await supabase.from('bookings').insert({
            booking_code: newCode,
            venue_id: selectedVenue.id,
            venue_name: selectedVenue.name,
            sport: booking.sport || selectedVenue.sport || 'Badminton',
            booking_date: booking.date,
            booking_time: `${slotRange} · Court ${targetMoveCourt}`,
            time_slot: `${slotRange} · Court ${targetMoveCourt}`,
            court_count: 1,
            price: movedPrice,
            total_amount: movedPrice,
            status: 'Confirmed',
            customer_name: booking.customerName || 'Player',
            customer_email: booking.customerEmail || '',
            user_id: booking.userId || null,
          });

          if (insertErr) throw insertErr;
        }
      }

      setSelectedBookedCells([]);
      await fetchVenueBookings();
    } catch (err: any) {
      console.error('Error moving bookings:', err);
      alert(`Could not move booking: ${err.message}`);
    } finally {
      setIsProcessingBookedAction(false);
    }
  };

  const handleConfirmSwapCourts = async () => {
    if (
      !selectedVenue ||
      swapSetA.length === 0 ||
      swapSetA.length !== swapSetB.length
    ) {
      return;
    }

    // Pair Set A and Set B slots by time (sorted by court number)
    const sortedA = [...swapSetA].sort(
      (a, b) => a.time.localeCompare(b.time) || a.court - b.court
    );
    const sortedB = [...swapSetB].sort(
      (a, b) => a.time.localeCompare(b.time) || a.court - b.court
    );

    for (let i = 0; i < sortedA.length; i++) {
      if (sortedA[i].time !== sortedB[i].time) {
        alert(
          'Set A and Set B must have matching timeslots (e.g. both at 13:00) to swap courts.'
        );
        return;
      }
    }

    setIsSwapping(true);
    try {
      // Build a list of court replacements: { booking, fromCourt, toCourt, time }
      const moves: {
        booking: DashboardBooking;
        fromCourt: number;
        toCourt: number;
        time: string;
      }[] = [];

      for (let i = 0; i < sortedA.length; i++) {
        moves.push({
          booking: sortedA[i].booking,
          fromCourt: sortedA[i].court,
          toCourt: sortedB[i].court,
          time: sortedA[i].time,
        });
        moves.push({
          booking: sortedB[i].booking,
          fromCourt: sortedB[i].court,
          toCourt: sortedA[i].court,
          time: sortedB[i].time,
        });
      }

      // Group moves by booking record so multi-court bookings update cleanly in one pass
      const movesByBooking = new Map<
        string,
        { booking: DashboardBooking; items: typeof moves }
      >();
      moves.forEach((m) => {
        const bKey = m.booking.dbId || m.booking.id;
        const entry = movesByBooking.get(bKey) || {
          booking: m.booking,
          items: [],
        };
        entry.items.push(m);
        movesByBooking.set(bKey, entry);
      });

      for (const [, { booking, items }] of movesByBooking.entries()) {
        const rawTime = String(booking.time || '');
        const slotRange =
          rawTime.match(/\d{2}:\d{2}\s*[-–]\s*\d{2}:\d{2}/)?.[0] ||
          toFullSlotLabel(items[0].time);

        const courtListMatch = rawTime.match(/Courts?\s*([\d,\s]+)/i);
        const existingCourts = courtListMatch
          ? courtListMatch[1]
              .split(',')
              .map((n) => parseInt(n.trim(), 10))
              .filter((n) => !isNaN(n))
          : Array.from(
              { length: Math.max(1, Number(booking.courtCount || 1)) },
              (_, idx) => idx + 1
            );

        const movedFromSet = new Set(items.map((it) => it.fromCourt));
        const newTargetCourts = items
          .map((it) => it.toCourt)
          .sort((a, b) => a - b);
        const untouchedCourts = existingCourts
          .filter((c) => !movedFromSet.has(c))
          .sort((a, b) => a - b);

        const updateFilter =
          booking.dbId &&
          (UUID_REGEX.test(booking.dbId) || /^\d+$/.test(booking.dbId))
            ? { col: 'id', val: booking.dbId }
            : { col: 'booking_code', val: booking.id };

        if (untouchedCourts.length === 0) {
          // Entire booking moved to new court(s)
          const updatedLabel =
            newTargetCourts.length === 1
              ? `${slotRange} · Court ${newTargetCourts[0]}`
              : `${slotRange} · Courts ${newTargetCourts.join(', ')}`;

          const { data: updatedRows, error } = await supabase
            .from('bookings')
            .update({
              time_slot: updatedLabel,
              booking_time: updatedLabel,
            })
            .eq(updateFilter.col, updateFilter.val)
            .select('id');

          if (error) throw error;
          if (!updatedRows || updatedRows.length === 0) {
            throw new Error(
              'Database permission (RLS) blocked updating one of the bookings.'
            );
          }
        } else {
          // Partial swap: keep untouched courts on original row, insert swapped court(s) as a separate row
          const remainingLabel =
            untouchedCourts.length === 1
              ? `${slotRange} · Court ${untouchedCourts[0]}`
              : `${slotRange} · Courts ${untouchedCourts.join(', ')}`;

          const swappedLabel =
            newTargetCourts.length === 1
              ? `${slotRange} · Court ${newTargetCourts[0]}`
              : `${slotRange} · Courts ${newTargetCourts.join(', ')}`;

          const unitPrice =
            existingCourts.length > 0
              ? Number(booking.price || 0) / existingCourts.length
              : Number(booking.price || 0);
          const remainingPrice =
            Math.round(unitPrice * untouchedCourts.length * 100) / 100;
          const swappedPrice =
            Math.round(unitPrice * newTargetCourts.length * 100) / 100;

          const { data: updatedRows, error: updateErr } = await supabase
            .from('bookings')
            .update({
              time_slot: remainingLabel,
              booking_time: remainingLabel,
              court_count: untouchedCourts.length,
              price: remainingPrice,
              total_amount: remainingPrice,
            })
            .eq(updateFilter.col, updateFilter.val)
            .select('id');

          if (updateErr) throw updateErr;
          if (!updatedRows || updatedRows.length === 0) {
            throw new Error(
              'Database permission (RLS) blocked updating one of the bookings.'
            );
          }

          const newCode = `MTN-${Math.random()
            .toString(36)
            .substring(2, 8)
            .toUpperCase()}`;
          const { error: insertErr } = await supabase.from('bookings').insert({
            booking_code: newCode,
            venue_id: selectedVenue.id,
            venue_name: selectedVenue.name,
            sport: booking.sport || selectedVenue.sport || 'Badminton',
            booking_date: booking.date,
            booking_time: swappedLabel,
            time_slot: swappedLabel,
            court_count: newTargetCourts.length,
            price: swappedPrice,
            total_amount: swappedPrice,
            status: 'Confirmed',
            customer_name: booking.customerName || 'Player',
            customer_email: booking.customerEmail || '',
            user_id: booking.userId || null,
          });

          if (insertErr) throw insertErr;
        }
      }

      resetSwapMode();
      await fetchVenueBookings();
    } catch (err: any) {
      console.error('Error swapping courts:', err);
      alert(`Could not swap courts: ${err.message}`);
    } finally {
      setIsSwapping(false);
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
  const openHourNum = parseInt(openTime.split(':')[0], 10);

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
                setSelectedBookedCells([]);
                resetSwapMode();
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

          {hasBothRoles ? (
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
          ) : (
            <div className="flex items-center gap-2 rounded-2xl bg-[#101310] px-4 py-2 text-xs font-black text-[#d8ff3e] shadow-sm">
              {activeRole === 'coach' ? (
                <>
                  <UserCheck size={15} /> Coach Portal
                </>
              ) : (
                <>
                  <Building2 size={15} /> Venue Owner
                </>
              )}
            </div>
          )}
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
                    {isSwapMode
                      ? swapStep === 'A'
                        ? 'Step 1: Click booked red slot(s) for Set A, then click "Next: Select Set B".'
                        : `Step 2: Click ${swapSetA.length} booked red ${
                            swapSetA.length === 1 ? 'slot' : 'slots'
                          } for Set B to swap with Set A.`
                      : isBookingMode
                      ? 'Select one or more open white slots below, then confirm to book.'
                      : 'White = Available · Red = Booked (click red slots to select, move, or cancel).'}
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
                        setSelectedBookedCells([]);
                        resetSwapMode();
                      }}
                      className="bg-transparent outline-none"
                    />
                  </label>

                  {/* BOOK COURT BUTTON */}
                  <button
                    type="button"
                    onClick={() => {
                      if (isEditingConfig) setIsEditingConfig(false);
                      resetSwapMode();
                      setSelectedBookedCells([]);
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

                  {/* SWAP COURTS BUTTON */}
                  <button
                    type="button"
                    onClick={() => {
                      if (isEditingConfig) setIsEditingConfig(false);
                      if (isBookingMode) {
                        setIsBookingMode(false);
                        setSelectedSlots([]);
                      }
                      setSelectedBookedCells([]);
                      if (isSwapMode) {
                        resetSwapMode();
                      } else {
                        setIsSwapMode(true);
                        setSwapStep('A');
                        setSwapSetA([]);
                        setSwapSetB([]);
                      }
                    }}
                    className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold transition ${
                      isSwapMode
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'border border-black/15 bg-[#f7f8f4] text-black hover:bg-[#eef7cf]'
                    }`}
                  >
                    {isSwapMode ? (
                      <>
                        <X size={14} /> Cancel Swap
                      </>
                    ) : (
                      <>
                        <ArrowRightLeft size={14} /> Swap Courts
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
                      resetSwapMode();
                      setSelectedBookedCells([]);
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

              {/* SWAP COURTS STEP-BY-STEP BAR */}
              {isSwapMode && (
                <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50/90 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`rounded-lg px-2.5 py-1 font-black ${
                        swapStep === 'A'
                          ? 'bg-[#101310] text-[#d8ff3e]'
                          : 'bg-red-700 text-white'
                      }`}
                    >
                      Set A ({swapSetA.length}):{' '}
                      {swapSetA.length > 0
                        ? swapSetA
                            .map(
                              (c) =>
                                `C${c.court} (${
                                  c.booking.customerName || 'Walk-in'
                                })`
                            )
                            .join(', ')
                        : 'None'}
                    </span>

                    <ArrowRightLeft size={14} className="text-black/50" />

                    <span
                      className={`rounded-lg px-2.5 py-1 font-black ${
                        swapStep === 'B'
                          ? 'bg-amber-600 text-white'
                          : 'bg-white border border-black/15 text-black/60'
                      }`}
                    >
                      Set B ({swapSetB.length}/{swapSetA.length || '?'}):{' '}
                      {swapSetB.length > 0
                        ? swapSetB
                            .map(
                              (c) =>
                                `C${c.court} (${
                                  c.booking.customerName || 'Walk-in'
                                })`
                            )
                            .join(', ')
                        : 'None'}
                    </span>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {swapStep === 'A' ? (
                      <button
                        type="button"
                        disabled={swapSetA.length === 0}
                        onClick={() => setSwapStep('B')}
                        className="rounded-xl bg-[#101310] px-4 py-2 text-xs font-black text-[#d8ff3e] transition hover:bg-black/85 disabled:opacity-40"
                      >
                        Next: Select Set B ({swapSetA.length}) →
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={isSwapping}
                          onClick={() => {
                            setSwapSetB([]);
                            setSwapStep('A');
                          }}
                          className="rounded-xl border border-black/15 bg-white px-3 py-2 text-xs font-bold text-black/70 hover:text-black"
                        >
                          ← Edit Set A
                        </button>
                        <button
                          type="button"
                          disabled={
                            isSwapping ||
                            swapSetA.length === 0 ||
                            swapSetB.length !== swapSetA.length
                          }
                          onClick={handleConfirmSwapCourts}
                          className="flex items-center gap-1.5 rounded-xl bg-[#101310] px-4 py-2 text-xs font-black text-[#d8ff3e] transition hover:bg-black/85 disabled:opacity-40"
                        >
                          {isSwapping ? (
                            <>
                              <Loader2 size={14} className="animate-spin" /> Swapping...
                            </>
                          ) : (
                            <>
                              <Check size={14} /> Confirm Swap
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* SELECTED BOOKED SLOTS ACTION BAR (MOVE OR CANCEL) */}
              {selectedBookedCells.length > 0 && (
                <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50/80 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5 text-xs">
                    <span className="rounded-lg bg-red-600 px-2.5 py-1 font-black text-white">
                      {selectedBookedCells.length} Booked{' '}
                      {selectedBookedCells.length === 1 ? 'Slot' : 'Slots'} Selected
                    </span>
                    <span className="line-clamp-2 font-semibold text-black/70">
                      {Array.from(
                        new Set(
                          selectedBookedCells.map(
                            (c) =>
                              c.booking.customerName ||
                              c.booking.customerEmail ||
                              'Walk-in'
                          )
                        )
                      ).join(', ')}
                    </span>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {/* Move to another court */}
                    <div className="flex items-center gap-1.5 rounded-xl border border-black/15 bg-white px-2.5 py-1 text-xs font-bold">
                      <ArrowRightLeft size={13} className="text-black/50" />
                      <span className="text-black/60">Move to:</span>
                      <select
                        value={targetMoveCourt}
                        disabled={
                          isProcessingBookedAction || validMoveCourts.length === 0
                        }
                        onChange={(e) => setTargetMoveCourt(Number(e.target.value))}
                        className="bg-transparent font-extrabold text-black outline-none"
                      >
                        {Array.from({ length: totalCourts }).map((_, idx) => {
                          const cNum = idx + 1;
                          const canMoveHere = validMoveCourts.includes(cNum);
                          return (
                            <option
                              key={cNum}
                              value={cNum}
                              disabled={!canMoveHere}
                            >
                              Court {cNum} {!canMoveHere ? '(Occupied)' : ''}
                            </option>
                          );
                        })}
                      </select>
                      <button
                        type="button"
                        disabled={
                          isProcessingBookedAction ||
                          validMoveCourts.length === 0 ||
                          selectedBookedCells.every(
                            (c) => c.court === targetMoveCourt
                          )
                        }
                        onClick={handleMoveSelectedToCourt}
                        className="ml-1 rounded-lg bg-[#101310] px-3 py-1 text-[11px] font-black text-[#d8ff3e] transition hover:bg-black/85 disabled:opacity-40"
                      >
                        {isProcessingBookedAction ? 'Moving...' : 'Move'}
                      </button>
                    </div>

                    {/* Bulk cancel */}
                    <button
                      type="button"
                      disabled={isProcessingBookedAction}
                      onClick={handleBulkCancelSelected}
                      className="flex items-center gap-1 rounded-xl bg-red-600 px-3.5 py-1.5 text-xs font-black text-white transition hover:bg-red-700 disabled:opacity-40"
                    >
                      {isProcessingBookedAction ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <XCircle size={13} />
                      )}
                      Cancel Selected ({selectedBookedCells.length})
                    </button>

                    {/* Clear selection */}
                    <button
                      type="button"
                      disabled={isProcessingBookedAction}
                      onClick={() => setSelectedBookedCells([])}
                      className="rounded-xl border border-black/15 bg-white px-2.5 py-1.5 text-xs font-bold text-black/60 hover:text-black"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}

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
              {!isBookingMode && !isSwapMode && selectedBookedCells.length === 0 && (
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
                      onChange={(e) => handleOpenTimeChange(e.target.value)}
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
                      {DEFAULT_HOURS.map((h) => {
                        const hNum = parseInt(h.split(':')[0], 10);
                        const isInvalidClose = h !== '00:00' && hNum <= openHourNum;
                        return (
                          <option key={h} value={h} disabled={isInvalidClose}>
                            {h}
                          </option>
                        );
                      })}
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
                          const cellKey = `C${courtNum}_${time}`;
                          const booking = bookedCellMap[cellKey];
                          const isBooked = Boolean(booking);
                          const isBookedSelected = selectedBookedCells.some(
                            (c) => c.key === cellKey
                          );
                          const isSwapA = swapSetA.some((c) => c.key === cellKey);
                          const isSwapB = swapSetB.some((c) => c.key === cellKey);
                          const isOpenSelected = selectedSlots.some(
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
                                    ? isSwapA
                                      ? `Set A (${guestName})`
                                      : isSwapB
                                      ? `Set B (${guestName})`
                                      : isBookedSelected
                                      ? `Selected (${guestName}) — click to unselect`
                                      : `Booked (${guestName}) — click to select`
                                    : isBookingMode
                                    ? isOpenSelected
                                      ? 'Selected — click to unselect'
                                      : 'Click to select slot'
                                    : 'Available (click "Book Court" to book)'
                                }
                                className={`flex h-7 w-full items-center justify-center text-[10px] font-black transition-colors cursor-pointer ${
                                  isBooked
                                    ? isSwapA
                                      ? 'bg-red-800 text-[#d8ff3e] ring-2 ring-inset ring-black'
                                      : isSwapB
                                      ? 'bg-amber-500 text-black ring-2 ring-inset ring-black'
                                      : isBookedSelected
                                      ? 'bg-red-700 text-white ring-2 ring-inset ring-black'
                                      : 'bg-red-500 text-white hover:bg-red-600'
                                    : isOpenSelected
                                    ? 'bg-[#d8ff3e] text-black ring-1 ring-inset ring-black/40'
                                    : isBookingMode
                                    ? 'bg-white hover:bg-[#eef7cf]'
                                    : 'bg-white cursor-default'
                                }`}
                              >
                                {isSwapA
                                  ? 'A'
                                  : isSwapB
                                  ? 'B'
                                  : isBookedSelected || isOpenSelected
                                  ? '✓'
                                  : ''}
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

            {/* VENUE MASTER RESERVATION LIST */}
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
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
            <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-black/45">
                <span>COACHING REVENUE</span>
                <DollarSign size={18} className="text-[#81971d]" />
              </div>
              <p className="mt-2 text-3xl font-black">{money(0)}</p>
            </div>

            <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-black/45">
                <span>CLIENT SESSIONS</span>
                <CheckCircle2 size={18} className="text-green-600" />
              </div>
              <p className="mt-2 text-3xl font-black">0</p>
            </div>

            <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-black/45">
                <span>CANCELLATIONS</span>
                <XCircle size={18} className="text-red-500" />
              </div>
              <p className="mt-2 text-3xl font-black">0</p>
            </div>
          </div>

          <div className="mt-8 rounded-3xl border border-black/10 bg-white p-6 sm:p-8 shadow-sm">
            <h2 className="text-2xl font-black tracking-tight">
              Coaching Sessions
            </h2>
            <p className="mt-1 text-xs text-black/50">
              Your upcoming and past player coaching sessions.
            </p>
            <div className="mt-6 rounded-2xl border border-black/10 p-8 text-center text-xs font-bold text-black/45">
              No coaching sessions booked yet.
            </div>
          </div>
        </>
      )}
    </section>
  );
}