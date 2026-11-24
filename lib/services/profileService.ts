import { supabase } from '@/lib/supabase';

export type SportEntry = {
  sport: string;
  level: 'Casual' | 'Intermediate' | 'Club' | 'Competitive';
};

export type UserProfile = {
  id: string;
  email: string;
  phone?: string | null;
  full_name: string;
  display_name: string;
  avatar_url: string;
  bio: string;
  home_area: string;
  handedness: string;
  preferred_format: string;
  open_to_match: boolean;
  sports: SportEntry[];
  gear: string[];
};

export const profileService = {
  async getOrCreate(user: any): Promise<UserProfile | null> {
    if (!user?.id) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (data) {
      return {
        ...data,
        display_name:
          data.display_name ||
          data.full_name ||
          user.email?.split('@')[0] ||
          'Player',
        avatar_url: data.avatar_url || '',
        sports:
          Array.isArray(data.sports) && data.sports.length > 0
            ? data.sports
            : [{ sport: 'Badminton', level: 'Intermediate' }],
        gear: Array.isArray(data.gear) ? data.gear : [],
      } as UserProfile;
    }

    if (error) {
      console.error('Error reading profile:', error);
    }

    const meta = user.user_metadata || {};
    const defaultFull = meta.full_name || meta.name || '';
    const defaultDisplay =
      defaultFull || user.email?.split('@')[0] || 'Player';

    const newRow: UserProfile = {
      id: user.id,
      email: user.email || '',
      full_name: defaultFull,
      display_name: defaultDisplay,
      avatar_url: '', // Always defaults to empty so DefaultAvatar silhouette shows
      bio: '',
      home_area: '',
      handedness: 'Right-handed',
      preferred_format: 'Doubles',
      open_to_match: true,
      sports: [{ sport: 'Badminton', level: 'Intermediate' }],
      gear: [],
    };

    const { data: inserted, error: insertError } = await supabase
      .from('profiles')
      .upsert(newRow, { onConflict: 'id' })
      .select('*')
      .single();

    if (insertError) {
      console.error('Error creating profile:', insertError);
      return newRow;
    }

    return inserted as UserProfile;
  },

  async update(
    userId: string,
    updates: Partial<Omit<UserProfile, 'id' | 'email'>>
  ): Promise<{ profile: UserProfile | null; error: string | null }> {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select('*')
      .single();

    if (error) {
      return { profile: null, error: error.message };
    }

    return { profile: data as UserProfile, error: null };
  },

  async uploadAvatarBlob(
    userId: string,
    blob: Blob,
    fallbackDataUrl: string
  ): Promise<string> {
    const filePath = `${userId}/avatar-${Date.now()}.jpg`;
    const { error } = await supabase.storage
      .from('avatars')
      .upload(filePath, blob, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (error) {
      console.warn('Storage upload fallback:', error.message);
      return fallbackDataUrl;
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    return data.publicUrl;
  },
};