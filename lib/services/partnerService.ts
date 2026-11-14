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

export interface OperatingHours {
  open_time: string;
  close_time: string;
  slot_duration_minutes?: number;
  days_open?: string[];
  [key: string]: any;
}

export interface MatrixData {
  total_courts: number;
  price?: number;
  price_per_hour?: number;
  operating_hours: OperatingHours;
}

export const partnerService = {
  async getUserApplicationStatuses(userId: string) {
    try {
      const [venueRes, coachRes] = await Promise.all([
        supabase
          .from('venue_applications')
          .select('status')
          .eq('user_id', userId)
          .in('status', ['pending', 'pending_motion_approval', 'approved'])
          .order('created_at', { ascending: false })
          .limit(1),
        supabase
          .from('coach_venue_affiliations')
          .select('status')
          .eq('coach_user_id', userId)
          .in('status', ['pending', 'pending_venue_approval', 'approved'])
          .order('created_at', { ascending: false })
          .limit(1),
      ]);

      return {
        venueStatus: venueRes.data?.[0]?.status || null,
        coachStatus: coachRes.data?.[0]?.status || null,
      };
    } catch (error) {
      console.error('getUserApplicationStatuses Error:', error);
      return { venueStatus: null, coachStatus: null };
    }
  },

  async submitVenueApplication(userId: string, data: VenueApplicationData) {
    try {
      // 1. Check if user already has a pending or approved venue application
      const { data: existing, error: checkError } = await supabase
        .from('venue_applications')
        .select('id, status')
        .eq('user_id', userId)
        .in('status', ['pending', 'pending_motion_approval', 'approved'])
        .limit(1);

      if (checkError) throw checkError;

      if (existing && existing.length > 0) {
        return {
          success: false,
          error: 'You already have an active or pending venue application.',
          alreadyExists: true,
          status: existing[0].status,
        };
      }

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

      if (error) {
        if (error.code === '23505') {
          return {
            success: false,
            error: 'You already have an active or pending venue application.',
            alreadyExists: true,
          };
        }
        throw error;
      }

      return { success: true, data: result };
    } catch (error: any) {
      console.error('submitVenueApplication Error:', error);
      return { success: false, error: error.message };
    }
  },

  async submitCoachApplication(userId: string, data: CoachApplicationData) {
    try {
      const { data: existing, error: checkError } = await supabase
        .from('coach_venue_affiliations')
        .select('id, status')
        .eq('coach_user_id', userId)
        .in('status', ['pending', 'pending_venue_approval', 'approved'])
        .limit(1);

      if (checkError) throw checkError;

      if (existing && existing.length > 0) {
        return {
          success: false,
          error: 'You already have an active or pending coach application.',
          alreadyExists: true,
          status: existing[0].status,
        };
      }

      const { data: result, error } = await supabase
        .from('coach_venue_affiliations')
        .insert([
          {
            coach_user_id: userId,
            coach_name: data.coachName,
            coach_email: data.coachEmail,
            sport: data.sport,
            hourly_rate: data.hourlyRate,
            bio: data.bio,
            employment_type: data.employmentType,
            venue_id: data.venueId || null,
            status: data.employmentType === 'freelance' ? 'approved' : 'pending_venue_approval',
          },
        ])
        .select();

      if (error) {
        if (error.code === '23505') {
          return {
            success: false,
            error: 'You already have an active or pending coach application.',
            alreadyExists: true,
          };
        }
        throw error;
      }

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
        .in('status', ['pending', 'pending_motion_approval'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('getPendingVenueApplications error:', error);
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

  async getAllVenues() {
    try {
      const { data, error } = await supabase
        .from('venues')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('getAllVenues Error:', error);
      return [];
    }
  },

  async getVenueById(venueId: string) {
    try {
      const { data, error } = await supabase
        .from('venues')
        .select('*')
        .eq('id', venueId)
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error: any) {
      console.error('getVenueById Error:', error);
      return { success: false, error: error.message };
    }
  },

  async deleteVenueAndResetUser(venueId: string, ownerId?: string) {
    try {
      const { data, error } = await supabase.rpc('delete_venue_and_reset_user', {
        p_venue_id: venueId,
        p_owner_id: ownerId || null,
      });

      if (error) throw error;

      if (data && data.success === false) {
        throw new Error(data.error || 'Failed to delete venue');
      }

      return { success: true };
    } catch (error: any) {
      console.error('deleteVenueAndResetUser Error:', error);
      return { success: false, error: error.message };
    }
  },

  async updateVenueMatrix(venueId: string, matrixData: MatrixData) {
    try {
      const priceValue = matrixData.price_per_hour ?? matrixData.price;

      const payload: Record<string, any> = {
        total_courts: Number(matrixData.total_courts),
        operating_hours: matrixData.operating_hours,
        updated_at: new Date().toISOString(),
      };

      if (priceValue !== undefined) {
        payload.price_per_hour = Number(priceValue);
        payload.price = Number(priceValue);
      }

      const { data, error } = await supabase
        .from('venues')
        .update(payload)
        .eq('id', venueId)
        .select();

      if (error) throw error;
      return { success: true, data };
    } catch (error: any) {
      console.error('updateVenueMatrix Error:', error);
      return { success: false, error: error.message };
    }
  },

  async updateVenueDetails(venueId: string, updates: Record<string, any>) {
    try {
      const { data, error } = await supabase
        .from('venues')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', venueId)
        .select();

      if (error) throw error;
      return { success: true, data };
    } catch (error: any) {
      console.error('updateVenueDetails Error:', error);
      return { success: false, error: error.message };
    }
  },
};