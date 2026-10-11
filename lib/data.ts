export type Sport = 'All sports' | 'Badminton' | 'Tennis' | 'Basketball' | 'Futsal';

export type Venue = {
  id: string;
  name: string;
  sport: string;
  area: string;
  facilities: string[];
  slots: string[];
  price: number;
  rating?: number;
  image?: string;
  location?: string;
  tag?: string;
  reviews?: number;
  description?: string;
  image_url?: string;
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

export const sports: { name: Sport; icon: string }[] = [
  { name: 'All sports', icon: '✳' },
  { name: 'Badminton', icon: '🏸' },
  { name: 'Tennis', icon: '🎾' },
  { name: 'Basketball', icon: '🏀' },
  { name: 'Futsal', icon: '⚽' },
];