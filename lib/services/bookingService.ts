import { supabase } from '@/lib/supabase';
// import { ALL_BOOKING_SLOTS } from '@/lib/constants';

export const DEFAULT_VENUE_IMAGE =
  'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=800&q=80';

export const ALL_BOOKING_SLOTS = [
  '09:00 - 10:00',
  '10:00 - 11:00',
  '11:00 - 12:00',
  '12:00 - 13:00',
  '13:00 - 14:00',
  '14:00 - 15:00',
  '15:00 - 16:00',
  '16:00 - 17:00',
  '17:00 - 18:00',
  '18:00 - 19:00',
  '19:00 - 20:00',
  '20:00 - 21:00',
  '21:00 - 22:00',
];

export type Booking = {
  id: string;
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
      venue: b.venue_name || 'Court Booking',
      sport: b.sport || 'Sports',
      date: b.booking_date,
      time: b.booking_time || b.time_slot,
      price: Number(b.total_amount || b.price || 0),
      status: b.status === 'Cancelled' ? 'Cancelled' : 'Confirmed',
      pointsEarned: b.points_earned || 0,
    }));
  },

  async getOccupiedSlots(venueId: string, date: string): Promise<Record<string, number>> {
    const { data, error } = await supabase
      .from('bookings')
      .select('booking_time, time_slot, court_count')
      .eq('venue_id', venueId)
      .eq('booking_date', date)
      .neq('status', 'Cancelled');

    if (error) {
      console.error('Error fetching slot availability:', error);
      return {};
    }

    const counts: Record<string, number> = {};
    data?.forEach((b: any) => {
      const bookedQty = Number(b.court_count || 1);
      const rawSlotStr = String(b.time_slot || b.booking_time || '');

      ALL_BOOKING_SLOTS.forEach((fullSlot) => {
        const startTime = fullSlot.split(' - ')[0];
        if (rawSlotStr.includes(fullSlot) || rawSlotStr.includes(startTime)) {
          counts[fullSlot] = (counts[fullSlot] || 0) + bookedQty;
        }
      });
    });

    return counts;
  },

  async createViaRPC(input: CreateBookingInput) {
    const { data, error } = await supabase.rpc('create_court_booking', {
      p_venue_id: input.venueId,
      p_venue_name: input.venueName,
      p_sport: input.sport,
      p_booking_date: input.date,
      p_time_slot: input.timeSlot,
      p_court_count: input.courtCount,
      p_price: input.totalPrice,
      p_customer_name: input.customerName,
      p_customer_email: input.customerEmail,
      p_total_courts: input.totalCourts || 4,
    });

    if (error) {
      console.error('RPC Booking Error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  },

  async cancel(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'Cancelled' })
      .or(`booking_code.eq.${id},id.eq.${id}`);

    if (error) console.error('Failed to update booking status in Supabase:', error);
    return !error;
  },
};