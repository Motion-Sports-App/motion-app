import { supabase } from '@/lib/supabase';

export interface SportConfig {
  total_courts: number;
  price_per_hour: number;
  operating_hours?: OperatingHours;
}

export interface VenueApplicationData {
  name: string;
  sport: string;
  sports?: string[];
  sportConfigs?: Record<string, SportConfig>;
  area: string;
  address: string;
  totalCourts: number;
  price: number;
  description?: string;
  applicantEmail?: string;
}

export interface CoachApplicationData {
  coachName: string;
  coachEmail: string;
  sport: string;
  hourlyRate: number;
  bio: string;
}

export interface CoachVenueAffiliation {
  id: string;
  coach_user_id: string | null;
  coach_name: string;
  coach_email: string;
  sport: string;
  hourly_rate: number;
  bio?: string;
  employment_type?: string;
  venue_id?: string | null;
  venue_name?: string | null;
  initiated_by?: 'coach' | 'venue';
  status: 'pending_venue_approval' | 'pending_coach_approval' | 'approved' | 'rejected';
  created_at?: string;
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
  sports?: string[];
  sport_configs?: Record<string, SportConfig>;
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
      const userEmail = data.applicantEmail || userData.user?.email || '';

      const selectedSports =
        data.sports && data.sports.length > 0
          ? data.sports
          : data.sport
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);

      const normalizedConfigs: Record<string, SportConfig> = {};
      selectedSports.forEach((s) => {
        const existingCfg = data.sportConfigs?.[s];
        normalizedConfigs[s] = {
          total_courts: Number(existingCfg?.total_courts ?? data.totalCourts ?? 4),
          price_per_hour: Number(existingCfg?.price_per_hour ?? data.price ?? 350),
          operating_hours: existingCfg?.operating_hours || {
            open_time: '08:00',
            close_time: '22:00',
            slot_duration_minutes: 60,
          },
        };
      });

      const totalCourtsSum =
        Object.values(normalizedConfigs).reduce(
          (sum, cfg) => sum + Number(cfg.total_courts || 0),
          0
        ) || Number(data.totalCourts);

      const prices = Object.values(normalizedConfigs)
        .map((cfg) => Number(cfg.price_per_hour || 0))
        .filter((p) => p > 0);
      const basePrice =
        prices.length > 0 ? Math.min(...prices) : Number(data.price);

      const { data: result, error } = await supabase
        .from('venue_applications')
        .insert([
          {
            user_id: userId,
            applicant_email: userEmail,
            name: data.name,
            sport: selectedSports.join(', '),
            sports: selectedSports,
            sport_configs: normalizedConfigs,
            area: data.area,
            address: data.address,
            total_courts: totalCourtsSum,
            price: basePrice,
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

  // 1. Register standalone Coach Profile on Motion
  async submitCoachApplication(userId: string, data: CoachApplicationData) {
    try {
      const { data: existing, error: checkError } = await supabase
        .from('coach_venue_affiliations')
        .select('id, status')
        .eq('coach_user_id', userId)
        .is('venue_id', null)
        .limit(1);

      if (checkError) throw checkError;

      if (existing && existing.length > 0) {
        return {
          success: false,
          error: 'You already have an active coach profile on Motion.',
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
            coach_email: data.coachEmail.trim().toLowerCase(),
            sport: data.sport,
            hourly_rate: Number(data.hourlyRate),
            bio: data.bio,
            employment_type: 'coach',
            venue_id: null,
            initiated_by: 'coach',
            status: 'approved',
          },
        ])
        .select();

      if (error) {
        if (error.code === '23505') {
          return {
            success: false,
            error: 'You already have an active coach profile on Motion.',
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

  // 2. Coach applies to affiliate with a specific venue
  async applyCoachToVenue(
    userId: string,
    venue: { id: string; name: string },
    profile?: {
      coachName?: string;
      coachEmail?: string;
      sport?: string;
      hourlyRate?: number;
      bio?: string;
    }
  ) {
    try {
      const { data: baseProfile } = await supabase
        .from('coach_venue_affiliations')
        .select('*')
        .eq('coach_user_id', userId)
        .is('venue_id', null)
        .maybeSingle();

      const { data: existingPair } = await supabase
        .from('coach_venue_affiliations')
        .select('id, status')
        .eq('coach_user_id', userId)
        .eq('venue_id', venue.id)
        .in('status', ['pending_venue_approval', 'pending_coach_approval', 'approved'])
        .maybeSingle();

      if (existingPair) {
        return {
          success: false,
          error:
            existingPair.status === 'approved'
              ? `You are already affiliated with ${venue.name}.`
              : `You already have a pending request with ${venue.name}.`,
        };
      }

      const { data, error } = await supabase
        .from('coach_venue_affiliations')
        .insert([
          {
            coach_user_id: userId,
            coach_name: baseProfile?.coach_name || profile?.coachName || 'Coach',
            coach_email: (
              baseProfile?.coach_email ||
              profile?.coachEmail ||
              ''
            )
              .trim()
              .toLowerCase(),
            sport: baseProfile?.sport || profile?.sport || 'Badminton',
            hourly_rate: Number(baseProfile?.hourly_rate ?? profile?.hourlyRate ?? 500),
            bio: baseProfile?.bio || profile?.bio || '',
            employment_type: 'venue_affiliated',
            venue_id: venue.id,
            venue_name: venue.name,
            initiated_by: 'coach',
            status: 'pending_venue_approval',
          },
        ])
        .select();

      if (error) throw error;
      return { success: true, data };
    } catch (error: any) {
      console.error('applyCoachToVenue Error:', error);
      return { success: false, error: error.message };
    }
  },

  // 3. Venue owner adds/invites a coach to their venue by email
  async addCoachToVenueByEmail(
    venue: { id: string; name: string },
    coachInput: {
      coachEmail: string;
      coachName?: string;
      sport?: string;
      hourlyRate?: number;
    }
  ) {
    try {
      const normalizedEmail = coachInput.coachEmail.trim().toLowerCase();
      if (!normalizedEmail) {
        return { success: false, error: 'Please enter a coach email address.' };
      }

      // Look up existing coach profile on Motion by email
      const { data: existingCoach } = await supabase
        .from('coach_venue_affiliations')
        .select('*')
        .ilike('coach_email', normalizedEmail)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      // Check if already affiliated/invited to this venue
      const { data: dup } = await supabase
        .from('coach_venue_affiliations')
        .select('id, status')
        .eq('venue_id', venue.id)
        .ilike('coach_email', normalizedEmail)
        .in('status', ['pending_venue_approval', 'pending_coach_approval', 'approved'])
        .maybeSingle();

      if (dup) {
        return {
          success: false,
          error:
            dup.status === 'approved'
              ? 'This coach is already affiliated with your venue.'
              : 'An affiliation request or invite is already active for this coach.',
        };
      }

      const { data, error } = await supabase
        .from('coach_venue_affiliations')
        .insert([
          {
            coach_user_id: existingCoach?.coach_user_id || null,
            coach_name:
              existingCoach?.coach_name ||
              coachInput.coachName?.trim() ||
              normalizedEmail.split('@')[0],
            coach_email: normalizedEmail,
            sport: existingCoach?.sport || coachInput.sport || 'Badminton',
            hourly_rate: Number(
              existingCoach?.hourly_rate ?? coachInput.hourlyRate ?? 500
            ),
            bio: existingCoach?.bio || '',
            employment_type: 'venue_affiliated',
            venue_id: venue.id,
            venue_name: venue.name,
            initiated_by: 'venue',
            status: 'approved',
          },
        ])
        .select();

      if (error) throw error;
      return { success: true, data };
    } catch (error: any) {
      console.error('addCoachToVenueByEmail Error:', error);
      return { success: false, error: error.message };
    }
  },

  // Get all coach affiliations & requests for a specific venue
  async getVenueCoachAffiliations(venueId: string): Promise<CoachVenueAffiliation[]> {
    try {
      const { data, error } = await supabase
        .from('coach_venue_affiliations')
        .select('*')
        .eq('venue_id', venueId)
        .neq('status', 'rejected')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as CoachVenueAffiliation[];
    } catch (error) {
      console.error('getVenueCoachAffiliations Error:', error);
      return [];
    }
  },

  // Get base profile + venue affiliations for a coach
  async getCoachAffiliations(userId: string, userEmail?: string): Promise<CoachVenueAffiliation[]> {
    try {
      const filters = [`coach_user_id.eq.${userId}`];
      if (userEmail) {
        filters.push(`coach_email.ilike.${userEmail.trim().toLowerCase()}`);
      }

      const { data, error } = await supabase
        .from('coach_venue_affiliations')
        .select('*')
        .or(filters.join(','))
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as CoachVenueAffiliation[];
    } catch (error) {
      console.error('getCoachAffiliations Error:', error);
      return [];
    }
  },

  async respondToCoachAffiliation(
    affiliationId: string,
    status: 'approved' | 'rejected',
    coachUserId?: string
  ) {
    try {
      const updates: Record<string, any> = { status };
      if (coachUserId) {
        updates.coach_user_id = coachUserId;
      }

      const { error } = await supabase
        .from('coach_venue_affiliations')
        .update(updates)
        .eq('id', affiliationId);

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error('respondToCoachAffiliation Error:', error);
      return { success: false, error: error.message };
    }
  },

  async removeCoachAffiliation(affiliationId: string) {
    try {
      const { error } = await supabase
        .from('coach_venue_affiliations')
        .delete()
        .eq('id', affiliationId);

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error('removeCoachAffiliation Error:', error);
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
      const { data: appRow } = await supabase
        .from('venue_applications')
        .select('*')
        .eq('id', applicationId)
        .maybeSingle();

      const { data, error } = await supabase.rpc('approve_venue_application', {
        p_application_id: applicationId,
      });

      if (error) throw error;

      if (appRow) {
        const parsedSports: string[] =
          Array.isArray(appRow.sports) && appRow.sports.length > 0
            ? appRow.sports
            : String(appRow.sport || '')
                .split(',')
                .map((s: string) => s.trim())
                .filter(Boolean);

        const defaultConfigs: Record<string, SportConfig> = {};
        parsedSports.forEach((s: string) => {
          defaultConfigs[s] = appRow.sport_configs?.[s] || {
            total_courts: Number(appRow.total_courts || 4),
            price_per_hour: Number(appRow.price || 350),
            operating_hours: {
              open_time: '08:00',
              close_time: '22:00',
              slot_duration_minutes: 60,
            },
          };
        });

        const newVenueId =
          typeof data === 'string'
            ? data
            : data?.venue_id || data?.id || null;

        if (newVenueId) {
          await supabase
            .from('venues')
            .update({
              sport: parsedSports.join(', '),
              sports: parsedSports,
              sport_configs: defaultConfigs,
            })
            .eq('id', newVenueId);
        } else if (appRow.user_id && appRow.name) {
          await supabase
            .from('venues')
            .update({
              sport: parsedSports.join(', '),
              sports: parsedSports,
              sport_configs: defaultConfigs,
            })
            .eq('name', appRow.name)
            .or(`user_id.eq.${appRow.user_id},owner_id.eq.${appRow.user_id}`);
        }
      }

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

      if (matrixData.sports !== undefined) {
        payload.sports = matrixData.sports;
        if (matrixData.sports.length > 0) {
          payload.sport = matrixData.sports.join(', ');
        }
      }

      if (matrixData.sport_configs !== undefined) {
        payload.sport_configs = matrixData.sport_configs;
      }

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