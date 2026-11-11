export type Sport = 'All sports' | 'Badminton' | 'Tennis' | 'Basketball' | 'Futsal';

export interface OperatingHours {
  open_time: string;
  close_time: string;
  slot_duration_minutes?: number;
  days_open?: string[];
  [key: string]: any;
}

export type Venue = {
  id: string;
  name: string;
  sport: string;
  area: string;
  facilities: string[];
  slots: string[];
  price: number;
  price_per_hour?: number;
  total_courts?: number;
  user_id?: string;
  owner_id?: string;
  operating_hours?: OperatingHours | string;
  rating?: number;
  image?: string;
  image_url?: string;
  location?: string;
  tag?: string;
  reviews?: number;
  description?: string;
  address?: string;
  google_maps_url?: string;
};

export type Coach = {
  id: string;
  user_id?: string;
  full_name: string;
  sport: string;
  hourly_rate: number;
  location: string;
  bio?: string;
  image_url?: string;
  contact_email?: string;
  is_active?: boolean;
};

export const sports: { name: Sport; icon: string }[] = [
  { name: 'All sports', icon: '✳' },
  { name: 'Badminton', icon: '🏸' },
  { name: 'Tennis', icon: '🎾' },
  { name: 'Basketball', icon: '🏀' },
  { name: 'Futsal', icon: '⚽' },
];