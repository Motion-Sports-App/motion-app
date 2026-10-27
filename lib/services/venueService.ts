import { supabase } from '@/lib/supabase';
// import { ALL_BOOKING_SLOTS, DEFAULT_VENUE_IMAGE } from '@/lib/constants';
import type { Venue } from '@/lib/data';

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

export const venueService = {
  async getAll(): Promise<Venue[]> {
    const { data, error } = await supabase.from('venues').select('*');
    if (error) {
      console.error('Error fetching venues from Supabase:', error);
      return [];
    }

    return (data || []).map((v: any) => ({
      ...v,
      price: Number(v.price ?? v.price_per_hour ?? 0),
      image: v.image || v.image_url || DEFAULT_VENUE_IMAGE,
      facilities: Array.isArray(v.facilities) ? v.facilities : [],
      slots: Array.isArray(v.slots) ? v.slots : ALL_BOOKING_SLOTS,
      area: v.area || 'Bangkok',
      sport: v.sport || 'Sports',
    }));
  },
};