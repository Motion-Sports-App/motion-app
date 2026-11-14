import { supabase } from '@/lib/supabase';
import { ALL_BOOKING_SLOTS } from '@/lib/constants';

export type Booking = {
  id: string;
  dbId?: string;
  venue: string;
  sport: string;
  date: string;
  time: string;
  price: number;
  status: 'Confirmed' | 'Cancelled';
  pointsEarned?: number;
};

export type CreateBookingInput = {
  venueId: string;
  venueName: string;
  sport: string;
  date: string;
  timeSlot: string;
  courtCount: number;
  totalPrice: number;
  customerName: string;
  customerEmail: string;
  totalCourts?: number;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const sanitizeDateStr = (dateInput: string): string => {
  if (!dateInput) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;
  }
  if (dateInput.includes('T')) return dateInput.split('T')[0];
  return dateInput.trim();
};

const extractExplicitCourts = (rawSlot: string): number[] => {
  const match = rawSlot.match(/Courts?\s*([\d,\s]+)/i);
  if (!match) return [];
  return match[1]
    .split(',')
    .map((n) => parseInt(n.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0);
};

// Extracts ONLY the start times of time slots (e.g. "14:00" from "14:00 - 15:00 · Court 1")
// Never matches end times like "15:00" in "14:00 - 15:00"
const extractSlotStartTimes = (rawSlot: string): Set<string> => {
  const starts = new Set<string>();
  const rangeMatches = [...rawSlot.matchAll(/(\d{2}:\d{2})\s*[-–]\s*\d{2}:\d{2}/g)];
  if (rangeMatches.length > 0) {
    rangeMatches.forEach((m) => starts.add(m[1]));
  } else {
    const firstTime = rawSlot.match(/(\d{2}:\d{2})/);
    if (firstTime) starts.add(firstTime[1]);
  }
  return starts;
};

export const bookingService = {
  async getByUserEmail(email: string): Promise<Booking[]> {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('customer_email', email)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user bookings:', error);
      return [];
    }

    return (data || []).map((b: any) => ({
      id: b.booking_code || String(b.id),
      dbId: String(b.id),
      venue: b.venue_name || 'Court Booking',
      sport: b.sport || 'Sports',
      date: b.booking_date || b.date,
      time: b.booking_time || b.time_slot,
      price: Number(b.total_amount || b.price || 0),
      status:
        String(b.status || '').toLowerCase() === 'cancelled'
          ? 'Cancelled'
          : 'Confirmed',
      pointsEarned: b.points_earned || 0,
    }));
  },

  async getOccupiedSlots(
    venueId: string,
    date: string
  ): Promise<Record<string, number>> {
    const cleanDate = sanitizeDateStr(date);

    const { data, error } = await supabase
      .from('bookings')
      .select('booking_time, time_slot, court_count, status')
      .eq('venue_id', venueId)
      .eq('booking_date', cleanDate)
      .not('status', 'ilike', 'cancelled');

    if (error) {
      console.error('Error fetching slot availability:', error);
      return {};
    }

    const counts: Record<string, number> = {};
    (data || []).forEach((b: any) => {
      const bookedQty = Math.max(1, Number(b.court_count || 1));
      // Use time_slot first (fallback to booking_time) — never concatenate both to avoid double-counting
      const rawSlotStr = String(b.time_slot || b.booking_time || '');
      const bookedStartTimes = extractSlotStartTimes(rawSlotStr);

      ALL_BOOKING_SLOTS.forEach((fullSlot) => {
        const slotStartTime = fullSlot.split(' - ')[0].trim();
        if (bookedStartTimes.has(slotStartTime)) {
          counts[fullSlot] = (counts[fullSlot] || 0) + bookedQty;
        }
      });
    });

    return counts;
  },

  async createViaRPC(input: CreateBookingInput) {
    const cleanDate = sanitizeDateStr(input.date);
    const maxCourts = Math.max(1, Number(input.totalCourts || 4));
    const requestedQty = Math.max(1, Number(input.courtCount || 1));

    const rawSlots = input.timeSlot.includes('· Court')
      ? [input.timeSlot]
      : input.timeSlot
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

    const { data: existingBookings } = await supabase
      .from('bookings')
      .select('time_slot, booking_time, court_count, status')
      .eq('venue_id', input.venueId)
      .eq('booking_date', cleanDate)
      .not('status', 'ilike', 'cancelled');

    const assignCourtsForSlot = (slotStr: string): string => {
      if (/Court\s*\d+/i.test(slotStr)) return slotStr;

      const startTime = slotStr.match(/(\d{2}:\d{2})/)?.[1] || slotStr;
      const occupiedCourts = new Set<number>();
      let legacyUnnumberedCount = 0;

      (existingBookings || []).forEach((b: any) => {
        const raw = String(b.time_slot || b.booking_time || '');
        const starts = extractSlotStartTimes(raw);
        if (!starts.has(startTime)) return;

        const explicit = extractExplicitCourts(raw);
        if (explicit.length > 0) {
          explicit.forEach((c) => occupiedCourts.add(c));
        } else {
          legacyUnnumberedCount += Math.max(1, Number(b.court_count || 1));
        }
      });

      for (let i = 0; i < legacyUnnumberedCount; i++) {
        for (let c = 1; c <= maxCourts; c++) {
          if (!occupiedCourts.has(c)) {
            occupiedCourts.add(c);
            break;
          }
        }
      }

      const assignedCourts: number[] = [];
      for (
        let c = 1;
        c <= maxCourts && assignedCourts.length < requestedQty;
        c++
      ) {
        if (!occupiedCourts.has(c)) {
          assignedCourts.push(c);
          occupiedCourts.add(c);
        }
      }

      if (assignedCourts.length === 0) return slotStr;
      const courtLabel =
        assignedCourts.length === 1
          ? `Court ${assignedCourts[0]}`
          : `Courts ${assignedCourts.join(', ')}`;
      return `${slotStr} · ${courtLabel}`;
    };

    if (rawSlots.length > 1) {
      const perSlotPrice =
        Math.round((Number(input.totalPrice || 0) / rawSlots.length) * 100) /
        100;
      let firstData: any = null;

      for (const slot of rawSlots) {
        const enrichedSlot = assignCourtsForSlot(slot);
        const { data, error } = await supabase.rpc('create_court_booking', {
          p_venue_id: input.venueId,
          p_venue_name: input.venueName,
          p_sport: input.sport,
          p_booking_date: cleanDate,
          p_time_slot: enrichedSlot,
          p_court_count: requestedQty,
          p_price: perSlotPrice,
          p_customer_name: input.customerName,
          p_customer_email: input.customerEmail,
          p_total_courts: maxCourts,
        });

        if (error) {
          console.error('RPC Multi-Slot Booking Error:', error);
          return { success: false, error: error.message };
        }
        if (!firstData) firstData = data;
      }

      // Return firstData directly so VenueModal's `result.data.booking_code` works seamlessly
      return { success: true, data: firstData };
    }

    const finalTimeSlot = assignCourtsForSlot(rawSlots[0] || input.timeSlot);
    const { data, error } = await supabase.rpc('create_court_booking', {
      p_venue_id: input.venueId,
      p_venue_name: input.venueName,
      p_sport: input.sport,
      p_booking_date: cleanDate,
      p_time_slot: finalTimeSlot,
      p_court_count: requestedQty,
      p_price: input.totalPrice,
      p_customer_name: input.customerName,
      p_customer_email: input.customerEmail,
      p_total_courts: maxCourts,
    });

    if (error) {
      console.error('RPC Booking Error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  },

  async cancel(id: string): Promise<boolean> {
    const cleanId = String(id).trim();
    if (!cleanId) return false;

    if (UUID_REGEX.test(cleanId) || /^\d+$/.test(cleanId)) {
      const { data, error } = await supabase
        .from('bookings')
        .update({ status: 'Cancelled' })
        .eq('id', cleanId)
        .select('id');

      if (!error && data && data.length > 0) return true;
    }

    const { data: codeData, error: codeError } = await supabase
      .from('bookings')
      .update({ status: 'Cancelled' })
      .eq('booking_code', cleanId)
      .select('id');

    if (codeError) {
      console.error('Failed to update booking status in Supabase:', codeError);
      return false;
    }

    return Boolean(codeData && codeData.length > 0);
  },
};