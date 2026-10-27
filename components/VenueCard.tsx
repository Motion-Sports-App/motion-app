'use client';

import { ArrowRight, ArrowUpRight, MapPin, Star } from 'lucide-react';
import { DEFAULT_VENUE_IMAGE } from '@/lib/constants';
import type { Venue } from '@/lib/data';

const money = (n: number) => `฿${n.toLocaleString('en-US')}`;

export default function VenueCard({ venue, onSelect }: { venue: Venue; onSelect: () => void }) {
  return (
    <article className="group cursor-pointer" onClick={onSelect}>
      <div className="relative overflow-hidden rounded-2xl bg-[#e8ebdf]">
        <img
          src={venue.image || DEFAULT_VENUE_IMAGE}
          alt={`${venue.sport} at ${venue.name}`}
          className="h-56 w-full object-cover transition duration-500 group-hover:scale-[1.04]"
        />
        {venue.tag && (
          <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-2 text-[9px] font-black tracking-[.13em]">
            {venue.tag}
          </span>
        )}
        <span className="absolute bottom-3 right-3 grid h-10 w-10 place-items-center rounded-full bg-[#d8ff3e] transition group-hover:rotate-45">
          <ArrowUpRight size={19} />
        </span>
      </div>
      <div className="pt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.15em] text-[#81971d]">
              {venue.sport}
            </p>
            <h3 className="mt-1 text-xl font-black tracking-tight">{venue.name}</h3>
          </div>
          <div className="flex items-center gap-1 pt-1 text-xs font-extrabold">
            <Star size={13} fill="#d6a927" stroke="#d6a927" />
            {venue.rating || 'New'}
            <span className="font-medium text-black/35">({venue.reviews || 0})</span>
          </div>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-black/50">
          <MapPin size={14} />
          {venue.area}
        </p>
        <div className="mt-4 flex items-end justify-between border-t border-black/10 pt-3">
          <div>
            <span className="text-xl font-black">{money(venue.price)}</span>
            <span className="text-xs text-black/45"> / hour</span>
          </div>
          <span className="text-xs font-bold">
            View court <ArrowRight className="ml-1 inline" size={14} />
          </span>
        </div>
      </div>
    </article>
  );
}