// lib/data.ts

export type Sport = 'All sports' | 'Badminton' | 'Tennis' | 'Basketball' | 'Futsal';

export type Venue = {
  id: string;
  name: string;
  sport: string;
  location: string;
  address?: string;
  description?: string;
  price_per_hour: number;
  image_url?: string;
  rating?: number;
  reviews_count?: number;
  tag?: string;
  facilities?: string[];
  is_active?: boolean;
};

export type Coach = {
  id: string;
  full_name: string;
  sport: string;
  hourly_rate: number;
  location: string;
  bio?: string;
  image_url?: string;
  contact_email?: string;
  is_active?: boolean;
};

export const sportsList: { name: Sport; icon: string }[] = [
  { name: 'All sports', icon: '✳' },
  { name: 'Badminton', icon: '🏸' },
  { name: 'Tennis', icon: '🎾' },
  { name: 'Basketball', icon: '🏀' },
  { name: 'Futsal', icon: '⚽' },
];