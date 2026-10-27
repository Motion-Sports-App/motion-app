import { supabase } from '@/lib/supabase';

export type VenueApplication = {
  name: string;
  sport: string;
  area: string;
  address: string;
  totalCourts: number;
  price: number;
  description: string;
};

export type CoachApplication = {
  coachName: string;
  coachEmail: string;
  sport: string;
  hourlyRate: number;
  bio: string;
  employmentType: 'freelance' | 'venue_affiliated';
  venueId?: string; // Optional for freelancers
};

export const partnerService = {
  // Submit Venue Registration
  async submitVenueApplication(userId: string, data: VenueApplication) {
    const { error } = await supabase.from('venue_applications').insert([
      {
        user_id: userId,
        name: data.name,
        sport: data.sport,
        area: data.area,
        address: data.address,
        total_courts: data.totalCourts,
        price: data.price,
        description: data.description,
        status: 'pending_motion_approval',
      },
    ]);
    return { success: !error, error: error?.message };
  },

  // Submit Coach Registration (Freelance OR Venue Affiliated)
  async submitCoachApplication(userId: string, data: CoachApplication) {
    const isFreelance = data.employmentType === 'freelance';

    const { error } = await supabase.from('coach_venue_affiliations').insert([
      {
        coach_user_id: userId,
        coach_name: data.coachName,
        coach_email: data.coachEmail,
        sport: data.sport,
        hourly_rate: data.hourlyRate,
        bio: data.bio,
        employment_type: data.employmentType,
        venue_id: isFreelance ? null : data.venueId,
        status: isFreelance ? 'approved' : 'pending_venue_approval',
      },
    ]);

    // Also update coach profile in coaches table so they appear in discovery immediately if freelance
    if (isFreelance && !error) {
      await supabase.from('coaches').upsert([
        {
          user_id: userId,
          full_name: data.coachName,
          sport: data.sport,
          hourly_rate: data.hourlyRate,
          location: 'Bangkok (Freelance)',
          bio: data.bio,
          contact_email: data.coachEmail,
          is_active: true,
        },
      ]);
    }

    return { success: !error, error: error?.message };
  },

  // Fetch coaches requesting approval at a specific venue
  async getVenueCoachRequests(venueId: string) {
    const { data, error } = await supabase
      .from('coach_venue_affiliations')
      .select('*')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching venue coach requests:', error);
      return [];
    }
    return data || [];
  },

  // Venue Owner Approves or Declines a Coach
  async updateCoachAffiliationStatus(affiliationId: string, status: 'approved' | 'rejected') {
    const { error } = await supabase
      .from('coach_venue_affiliations')
      .update({ status })
      .eq('id', affiliationId);

    return !error;
  },

    // Add these methods inside partnerService object:

    // Fetch pending applications for Motion Team
    async getPendingVenueApplications() {
    const { data, error } = await supabase
        .from('venue_applications')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching venue applications:', error);
        return [];
    }
    return data || [];
    },

    // Motion Admin approves application & inserts into live venues table
    async approveVenueApplication(applicationId: string) {
    const { data, error } = await supabase.rpc('approve_venue_application', {
        p_application_id: applicationId,
    });

    if (error) {
        console.error('Approval Error:', error);
        return { success: false, error: error.message };
    }
    return { success: true, data };
    },

    // Motion Admin rejects application
    async rejectVenueApplication(applicationId: string) {
    const { error } = await supabase
        .from('venue_applications')
        .update({ status: 'rejected' })
        .eq('id', applicationId);

    return !error;
    },
};