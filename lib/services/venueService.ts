import { supabase } from '@/lib/supabase';
import { ALL_BOOKING_SLOTS, DEFAULT_VENUE_IMAGE } from '@/lib/constants';
import type { Venue } from '@/lib/data';

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

  // Add inside lib/services/venueService.ts
  async updateConfig(venueId: string, totalCourts: number, openTime: string, closeTime: string) {
    const { data, error } = await supabase
      .from('venues')
      .update({ 
        total_courts: totalCourts,
        // Stored optionally if open_time / close_time columns exist on your table
      })
      .eq('id', venueId)
      .select();

    if (error) throw error;
    return data;
  },
};