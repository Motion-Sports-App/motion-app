'use client';

import { useState, useEffect, useMemo } from 'react';
import { MapPin, Star, X } from 'lucide-react';
import { bookingService, type Booking } from '@/lib/services/bookingService';
import { ALL_BOOKING_SLOTS, DEFAULT_VENUE_IMAGE } from '@/lib/constants';
import type { Venue } from '@/lib/data';

const money = (n: number) => `฿${n.toLocaleString('en-US')}`;
const today = new Date();
const dateLabel = (d: Date) => d.toLocaleDateString('en-CA');

export default function VenueModal({
  venue,
  date,
  setDate,
  user,
  onClose,
  onBookSuccess,
}: {
  venue: Venue;
  date: string;
  setDate: (v: string) => void;
  user?: any;
  onClose: () => void;
  onBookSuccess: (booking: Booking) => void;
}) {
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [slotBookings, setSlotBookings] = useState<Record<string, number>>({});
  const [loadingAvailability, setLoadingAvailability] = useState(true);

  const [selectedSlots, setSelectedSlots] = useState<string[]>(['14:00 - 15:00']);
  const [courtCount, setCourtCount] = useState<number>(1);

  const totalCourts = venue.total_courts || 4;

  const mapSearchQuery = encodeURIComponent(
    venue.address || `${venue.name}, ${venue.area || 'Bangkok'}`
  );
  const googleMapsUrl =
    venue.google_maps_url || `https://www.google.com/maps/search/?api=1&query=${mapSearchQuery}`;
  const embedMapUrl = `https://maps.google.com/maps?q=${mapSearchQuery}&t=&z=15&ie=UTF8&iwloc=&output=embed`;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (user) {
      setCustomerEmail(user.email || '');
      setCustomerName(user.user_metadata?.full_name || '');
    }
  }, [user]);

  useEffect(() => {
    async function fetchAvailability() {
      if (!venue.id || !date) return;
      setLoadingAvailability(true);
      const counts = await bookingService.getOccupiedSlots(venue.id, date);
      setSlotBookings(counts);
      setLoadingAvailability(false);
    }
    fetchAvailability();
  }, [venue.id, date]);

  const maxAvailableCourts = useMemo(() => {
    if (selectedSlots.length === 0) return totalCourts;
    const remainingPerSelected = selectedSlots.map((s) => {
      const booked = slotBookings[s] || 0;
      return Math.max(0, totalCourts - booked);
    });
    const calculatedMin = Math.min(...remainingPerSelected);
    return isFinite(calculatedMin) ? calculatedMin : totalCourts;
  }, [selectedSlots, slotBookings, totalCourts]);

  useEffect(() => {
    if (selectedSlots.length === 0) return;
    const firstSelectedBooked = slotBookings[selectedSlots[0]] || 0;
    if (firstSelectedBooked >= totalCourts) {
      const firstOpen = ALL_BOOKING_SLOTS.find((s) => (slotBookings[s] || 0) < totalCourts);
      if (firstOpen) {
        setSelectedSlots([firstOpen]);
      }
    }
  }, [slotBookings, totalCourts]);

  useEffect(() => {
    if (courtCount > maxAvailableCourts && maxAvailableCourts > 0) {
      setCourtCount(maxAvailableCourts);
    } else if (maxAvailableCourts > 0 && courtCount < 1) {
      setCourtCount(1);
    }
  }, [maxAvailableCourts, courtCount]);

  const toggleSlot = (slot: string) => {
    const currentBooked = slotBookings[slot] || 0;
    if (currentBooked >= totalCourts) return;

    if (selectedSlots.includes(slot)) {
      if (selectedSlots.length > 1) {
        setSelectedSlots(selectedSlots.filter((s) => s !== slot));
      }
    } else {
      setSelectedSlots([...selectedSlots, slot].sort());
    }
  };

  const totalHours = selectedSlots.length;
  const totalPrice = venue.price * totalHours * courtCount;

  const isFormValid =
    date &&
    date >= dateLabel(today) &&
    selectedSlots.length > 0 &&
    maxAvailableCourts > 0 &&
    courtCount <= maxAvailableCourts &&
    (user || (customerName.trim().length > 0 && customerEmail.trim().length > 0));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isFormValid || submitting) return;

    setSubmitting(true);
    setErrorMsg('');

    const sortedSlots = [...selectedSlots].sort();
    const startRange = sortedSlots[0].split(' - ')[0];
    const endRange = sortedSlots[sortedSlots.length - 1].split(' - ')[1];

    const formattedTimeString =
      sortedSlots.length === 1
        ? sortedSlots[0]
        : `${startRange} – ${endRange} (${sortedSlots.length} hrs)`;

    const timeSummary = selectedSlots.join(', ');

    const finalCustomerName = user
      ? user.user_metadata?.full_name || user.email?.split('@')[0] || 'Logged In User'
      : customerName;

    const finalCustomerEmail = user ? user.email || '' : customerEmail;

    const result = await bookingService.createViaRPC({
      venueId: venue.id,
      venueName: venue.name,
      sport: venue.sport,
      date,
      timeSlot: timeSummary,
      courtCount,
      totalPrice,
      customerName: finalCustomerName,
      customerEmail: finalCustomerEmail,
      totalCourts,
    });

    if (!result.success) {
      console.error('RPC Error:', result.error);
      setErrorMsg(result.error || 'Failed to save booking. Please try again.');
      setSubmitting(false);
      return;
    }

    const bookingCode = result.data.booking_code;
    const pointsEarned = result.data.points_earned;

    const newBooking: Booking = {
      id: bookingCode,
      venue: `${venue.name} (${courtCount} Court${courtCount > 1 ? 's' : ''})`,
      sport: venue.sport,
      date,
      time: formattedTimeString,
      price: totalPrice,
      pointsEarned: pointsEarned,
      status: 'Confirmed',
    };

    setSubmitting(false);
    onBookSuccess(newBooking);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="fixed inset-0 bg-black/60 transition-opacity" onClick={onClose} />
      <div
        className="relative z-10 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white sm:rounded-3xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative h-48 sm:h-56">
          <img src={venue.image || DEFAULT_VENUE_IMAGE} alt={venue.name} className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-black hover:bg-white shadow-md"
          >
            <X size={19} />
          </button>
          <span className="absolute bottom-4 left-4 rounded-full bg-[#d8ff3e] px-3 py-2 text-[10px] font-black tracking-widest text-black">
            {venue.sport.toUpperCase()}
          </span>
        </div>

        <div className="grid gap-7 p-5 sm:grid-cols-[1fr_1.1fr] sm:p-8">
          <div>
            <p className="flex items-center gap-1 text-xs font-bold text-black/50">
              <MapPin size={14} />
              {venue.area}
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-black">{venue.name}</h2>
            <div className="mt-2 flex items-center gap-1 text-sm text-black">
              <Star size={15} fill="#d6a927" stroke="#d6a927" />
              <b>{venue.rating || 'New'}</b>
              <span className="text-black/45">({venue.reviews || 0} reviews)</span>
            </div>

            <p className="mt-4 text-xs leading-5 text-black/60">
              {venue.description || 'No description provided.'}
            </p>

            <div className="mt-3 block sm:hidden">
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-[#f7f8f4] px-3.5 py-2 text-xs font-bold text-black hover:bg-gray-200 transition"
              >
                Open in Google Maps ↗
              </a>
            </div>

            <div className="mt-5 hidden sm:block">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-extrabold text-black uppercase">Address</h3>
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-extrabold text-[#758e1b] hover:underline"
                >
                  View larger map ↗
                </a>
              </div>
              {venue.address && <p className="mb-2 text-xs text-black/60">{venue.address}</p>}
              <div className="h-36 w-full overflow-hidden rounded-xl border border-black/10 bg-gray-100">
                <iframe
                  title="Venue Location Map"
                  width="100%"
                  height="100%"
                  className="border-0"
                  loading="lazy"
                  allowFullScreen
                  src={embedMapUrl}
                />
              </div>
            </div>

            <h3 className="mt-5 text-xs font-extrabold text-black uppercase">Facilities</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {venue.facilities.map((f) => (
                <span key={f} className="rounded-full bg-[#f2f4ed] px-2.5 py-1 text-[11px] font-semibold text-black">
                  {f}
                </span>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="rounded-2xl bg-[#f7f8f4] p-5 border border-black/10">
            <div className="flex items-end justify-between border-b border-black/10 pb-3">
              <h3 className="text-base font-black text-black">Select Slots</h3>
              <p className="text-black">
                <b className="text-lg">{money(venue.price)}</b>
                <span className="text-xs text-black/45">/hr/court</span>
              </p>
            </div>

            <label className="mt-3 block text-xs font-bold text-black/55 uppercase">
              Date
              <input
                type="date"
                value={date}
                min={dateLabel(today)}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-bold text-black outline-none"
              />
            </label>

            <div className="mt-3">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-bold text-black/55 uppercase">Time Slot(s)</span>
                {loadingAvailability ? (
                  <span className="text-[10px] text-black/40 font-semibold">Checking...</span>
                ) : (
                  <span className="text-[10px] font-extrabold text-[#758e1b] bg-[#eef7cf] px-2 py-0.5 rounded-full">
                    Multi-select active
                  </span>
                )}
              </div>

              <div className="max-h-40 overflow-y-auto grid grid-cols-2 gap-1.5 p-1 border border-black/10 rounded-xl bg-white">
                {ALL_BOOKING_SLOTS.map((slot) => {
                  const isSelected = selectedSlots.includes(slot);
                  const booked = slotBookings[slot] || 0;
                  const isFull = booked >= totalCourts;
                  const remaining = Math.max(0, totalCourts - booked);

                  return (
                    <button
                      type="button"
                      key={slot}
                      disabled={isFull}
                      onClick={() => toggleSlot(slot)}
                      className={`relative rounded-lg py-2 px-2 text-xs font-bold transition text-center flex flex-col items-center justify-center ${
                        isFull
                          ? 'bg-gray-100 text-gray-400 opacity-50 cursor-not-allowed line-through'
                          : isSelected
                          ? 'bg-[#101310] text-[#d8ff3e] shadow-sm'
                          : 'bg-[#f7f8f4] text-black hover:bg-gray-200'
                      }`}
                    >
                      <span>{slot} {isSelected && '✓'}</span>
                      <span className="text-[9px] font-normal opacity-80 mt-0.5">
                        {isFull ? 'Full' : `${remaining} courts available`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-3 border-t border-black/10 pt-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-black/70 uppercase block">Courts</label>
                  <span className="text-[10px] text-black/40">Max {maxAvailableCourts} for selected time</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={courtCount <= 1}
                    onClick={() => setCourtCount((prev) => Math.max(1, prev - 1))}
                    className="h-7 w-7 rounded-lg border border-black/15 bg-white font-extrabold text-xs text-black hover:bg-gray-100 disabled:opacity-40"
                  >
                    -
                  </button>
                  <span className="w-5 text-center text-xs font-extrabold text-black">{courtCount}</span>
                  <button
                    type="button"
                    disabled={courtCount >= maxAvailableCourts || maxAvailableCourts === 0}
                    onClick={() => setCourtCount((prev) => Math.min(maxAvailableCourts, prev + 1))}
                    className="h-7 w-7 rounded-lg border border-black/15 bg-white font-extrabold text-xs text-black hover:bg-gray-100 disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-3 border-t border-black/10 pt-3">
              {user ? (
                <div className="flex items-center justify-between rounded-xl border border-black/10 bg-white px-3 py-2 text-xs">
                  <div className="min-w-0 pr-2">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-black/40">Booking as</p>
                    <p className="truncate font-bold text-black">{user.user_metadata?.full_name || user.email}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#d8ff3e] px-2 py-0.5 text-[10px] font-black text-black">✓ Logged In</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-black/50">Guest Information</p>
                  <input
                    type="text"
                    required
                    placeholder="Name *"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs text-black outline-none focus:border-black/40"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Email *"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs text-black outline-none focus:border-black/40"
                  />
                </div>
              )}
            </div>

            {errorMsg && <p className="mt-2 text-xs font-bold text-red-600">{errorMsg}</p>}

            <div className="mt-3 rounded-xl bg-[#eef7cf] p-2.5 text-xs text-black space-y-0.5">
              <div className="flex justify-between font-medium text-[11px] text-black/70">
                <span>{totalHours} hr(s) × {courtCount} court(s)</span>
                <span>{money(venue.price)}/hr</span>
              </div>
              <div className="flex justify-between items-center font-black text-sm pt-0.5 border-t border-black/10">
                <span>Total Fee</span>
                <span className="text-base text-black">{money(totalPrice)}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={!isFormValid || submitting}
              className="mt-3 w-full rounded-full bg-[#d8ff3e] py-3 text-xs font-black text-black transition hover:bg-[#c9f02e] disabled:opacity-50"
            >
              {submitting ? 'Processing...' : `Confirm Booking (${money(totalPrice)})`}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}