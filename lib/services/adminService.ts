import { supabase } from '@/lib/supabase';
import type { Coach, Venue } from '@/lib/data';

export const adminService = {
  // Fetch coach profile tied to authenticated user
  async getCoachProfile(userId: string): Promise<Coach | null> {
    const { data, error } = await supabase
      .from('coaches')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching coach profile:', error);
    }
    return data || null;
  },

  // Save or update coach profile
  async saveCoachProfile(coachData: Partial<Coach>): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
      .from('coaches')
      .upsert(coachData, { onConflict: 'user_id' });

    if (error) {
      console.error('Error saving coach profile:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  },

  // Update venue court availability/pricing
  async updateVenueDetails(venueId: string, updates: Partial<Venue>): Promise<boolean> {
    const { error } = await supabase
      .from('venues')
      .update(updates)
      .eq('id', venueId);

    if (error) {
      console.error('Error updating venue details:', error);
      return false;
    }
    return true;
  },
};