import { supabase } from '@/lib/supabase';

export interface VenueApplicationData {
  name: string;
  sport: string;
  area: string;
  address: string;
  totalCourts: number;
  price: number;
  description?: string;
}

export interface CoachApplicationData {
  coachName: string;
  coachEmail: string;
  sport: string;
  hourlyRate: number;
  bio: string;
  employmentType: 'freelance' | 'venue_affiliated';
  venueId?: string;
}

export const partnerService = {
  async submitVenueApplication(userId: string, data: VenueApplicationData) {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData.user?.email || '';

      const { data: result, error } = await supabase
        .from('venue_applications')
        .insert([
          {
            user_id: userId,
            applicant_email: userEmail,
            name: data.name,
            sport: data.sport,
            area: data.area,
            address: data.address,
            total_courts: Number(data.totalCourts),
            price: Number(data.price),
            description: data.description || '',
            status: 'pending',
          },
        ])
        .select();

      if (error) throw error;
      return { success: true, data: result };
    } catch (error: any) {
      console.error('submitVenueApplication Error:', error);
      return { success: false, error: error.message };
    }
  },

  async submitCoachApplication(userId: string, data: CoachApplicationData) {
    try {
      const { data: result, error } = await supabase
        .from('coach_applications')
        .insert([
          {
            user_id: userId,
            coach_name: data.coachName,
            coach_email: data.coachEmail,
            sport: data.sport,
            hourly_rate: data.hourlyRate,
            bio: data.bio,
            employment_type: data.employmentType,
            venue_id: data.venueId || null,
            status: data.employmentType === 'freelance' ? 'approved' : 'pending',
          },
        ])
        .select();

      if (error) throw error;
      return { success: true, data: result };
    } catch (error: any) {
      console.error('submitCoachApplication Error:', error);
      return { success: false, error: error.message };
    }
  },

  async getPendingVenueApplications() {
    try {
      const { data, error } = await supabase
        .from('venue_applications')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('getPendingVenueApplications Error:', error);
      return [];
    }
  },

  async approveVenueApplication(applicationId: string) {
    try {
      const { data, error } = await supabase.rpc('approve_venue_application', {
        p_application_id: applicationId,
      });

      if (error) throw error;
      return { success: true, data };
    } catch (error: any) {
      console.error('approveVenueApplication Error:', error);
      return { success: false, error: error.message };
    }
  },

  async rejectVenueApplication(applicationId: string) {
    try {
      const { data, error } = await supabase
        .from('venue_applications')
        .update({ status: 'rejected' })
        .eq('id', applicationId)
        .select();

      if (error) throw error;
      return { success: true, data };
    } catch (error: any) {
      console.error('rejectVenueApplication Error:', error);
      return { success: false, error: error.message };
    }
  },

  async deleteVenueApplication(applicationId: string) {
    try {
      const { error } = await supabase
        .from('venue_applications')
        .delete()
        .eq('id', applicationId);

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error('deleteVenueApplication Error:', error);
      return { success: false, error: error.message };
    }
  },
};