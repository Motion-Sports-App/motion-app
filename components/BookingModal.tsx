'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// Generate confirmation code
const generateBookingCode = () => 
  'BK-' + Math.random().toString(36).substring(2, 8).toUpperCase();

interface BookingDetails {
  itemType: string;
  itemName: string;
  venueName?: string;
  venueId?: string;
  sport?: string;
  price: number;
  date: string;
  timeSlot: string;
}

export default function BookingModal({
  bookingDetails,
  onClose,
}: {
  bookingDetails: BookingDetails;
  onClose?: () => void;
}) {
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<{ full_name: string; phone: string; points: number } | null>(null);
  const [fetchingAuth, setFetchingAuth] = useState(true);

  // Guest inputs
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [loading, setLoading] = useState(false);

  // Success state for in-modal Thank You screen
  const [isSuccess, setIsSuccess] = useState(false);
  const [confirmedCode, setConfirmedCode] = useState('');

  const bookingPrice = bookingDetails?.price || 180;
  const pointsToEarn = Math.floor(bookingPrice / 10);

  // Normalize date string to YYYY-MM-DD
  const formattedDate = bookingDetails?.date
    ? (bookingDetails.date.includes('T') ? bookingDetails.date.split('T')[0] : bookingDetails.date)
    : new Date().toISOString().split('T')[0];

  useEffect(() => {
    async function loadUserData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, phone, points')
          .eq('id', user.id)
          .single();

        if (profile) setUserProfile(profile);
      }
      setFetchingAuth(false);
    }
    loadUserData();
  }, []);

  const handleClose = () => {
    setIsSuccess(false);
    if (typeof onClose === 'function') {
      onClose();
    }
  };

  async function handleConfirmBooking(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const bookingCode = generateBookingCode();

    const bookingPayload = {
      user_id: user ? user.id : null,
      booking_code: bookingCode,
      venue_id: bookingDetails.venueId || null,
      venue_name: bookingDetails.venueName || bookingDetails.itemName || 'Motion Arena',
      sport: bookingDetails.sport || 'Badminton',
      item_type: bookingDetails.itemType || 'court',
      item_name: bookingDetails.itemName || 'Badminton Court 1',
      booking_date: formattedDate,
      date: formattedDate, // Dual payload coverage for date column variations
      booking_time: bookingDetails.timeSlot,
      time_slot: bookingDetails.timeSlot,
      price: bookingPrice,
      total_amount: bookingPrice,
      status: 'confirmed',
      customer_name: user 
        ? (userProfile?.full_name || user.email?.split('@')[0] || 'Member')
        : guestName,
      customer_phone: user 
        ? (userProfile?.phone || 'N/A') 
        : guestPhone,
      customer_email: user 
        ? user.email 
        : (guestEmail || null),
      points_earned: user ? pointsToEarn : 0,
    };

    const { error } = await supabase.from('bookings').insert([bookingPayload]);

    setLoading(false);

    if (error) {
      console.error('Supabase Insert Error:', error);
      alert('Booking failed: ' + error.message);
    } else {
      setConfirmedCode(bookingCode);
      setIsSuccess(true);
    }
  }

  const formatTHB = (amount: number) =>
    new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      maximumFractionDigits: 0,
    }).format(amount);

  if (fetchingAuth) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="rounded-2xl bg-white p-6 shadow-xl text-center text-sm font-semibold">
          Loading reservation...
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl transition-all">
        {isSuccess ? (
          <div className="text-center py-4 space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#d8ff3e]">
              <span className="text-2xl font-bold">✓</span>
            </div>

            <h3 className="text-2xl font-black text-black">Booking Confirmed!</h3>
            <p className="text-xs text-gray-500">
              Your reservation has been locked in successfully.
            </p>

            <div className="my-4 rounded-2xl bg-gray-50 p-4 text-xs space-y-2 text-left">
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-500">Booking Reference:</span>
                <span className="font-extrabold text-black font-mono text-sm">{confirmedCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Venue / Item:</span>
                <span className="font-bold text-black">{bookingDetails.itemName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Date & Time:</span>
                <span className="font-bold text-black">{formattedDate} @ {bookingDetails.timeSlot}</span>
              </div>
              {user && (
                <div className="flex justify-between text-[#22c55e] font-bold pt-1">
                  <span>Points Earned:</span>
                  <span>+{pointsToEarn} PTS</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="w-full rounded-full bg-black py-3.5 text-sm font-black text-white hover:bg-gray-800 transition"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-xl font-black text-black">Confirm Reservation</h3>
                <p className="text-sm font-bold text-gray-500">
                  {bookingDetails.itemName} — {formatTHB(bookingPrice)}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-full bg-gray-100 p-2 text-xs font-bold text-gray-500 hover:bg-gray-200 hover:text-black transition"
              >
                ✕
              </button>
            </div>

            <div className="my-4 rounded-2xl bg-gray-50 p-3.5 text-xs text-gray-700 space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Date:</span>
                <span className="font-bold text-black">{formattedDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Time Slot:</span>
                <span className="font-bold text-black">{bookingDetails.timeSlot}</span>
              </div>
            </div>

            <form onSubmit={handleConfirmBooking} className="space-y-4">
              {user ? (
                <div className="space-y-3">
                  <div className="rounded-2xl bg-[#d8ff3e]/20 border border-[#d8ff3e] p-3.5 text-xs font-semibold text-black">
                    <div className="flex justify-between items-center">
                      <span>⚡ Member Fast-Checkout</span>
                      <span className="rounded-full bg-black text-[#d8ff3e] px-2 py-0.5 text-[10px] font-extrabold">
                        + {pointsToEarn} PTS
                      </span>
                    </div>
                    <p className="mt-1 text-gray-600 text-[11px]">
                      Logged in as <span className="font-bold text-black">{user.email}</span>
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-full bg-[#d8ff3e] py-3.5 text-sm font-black text-black transition hover:bg-[#c9f02e]"
                  >
                    {loading ? 'Processing Reservation...' : `Confirm & Book (${formatTHB(bookingPrice)})`}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-2xl bg-gray-100 p-3 text-xs text-gray-600">
                    💡 <span className="font-bold text-black">Guest Checkout.</span> Fill details to complete reservation.
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700">Booking Name *</label>
                    <input
                      type="text"
                      required
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="e.g. Somchai Jaidee"
                      className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-sm text-black outline-none focus:border-black"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700">Phone Number *</label>
                    <input
                      type="tel"
                      required
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      placeholder="081-234-5678"
                      className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-sm text-black outline-none focus:border-black"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700">Email (Optional)</label>
                    <input
                      type="email"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      placeholder="somchai@example.com"
                      className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-sm text-black outline-none focus:border-black"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-2 w-full rounded-full bg-black py-3.5 text-sm font-black text-white transition hover:bg-gray-800"
                  >
                    {loading ? 'Processing Reservation...' : `Confirm & Book (${formatTHB(bookingPrice)})`}
                  </button>
                </div>
              )}
            </form>
          </>
        )}
      </div>
    </div>
  );
}