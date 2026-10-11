"use client";

import { useEffect, useState, use } from "react";
import { supabase } from "@/lib/supabase";
import { Venue } from "@/lib/data";

const AVAILABLE_SLOTS = [
  '08:00', '09:00', '10:00', '11:00', 
  '13:00', '14:00', '15:00', '16:00', 
  '17:00', '18:00', '19:00', '20:00',
  '21:00', '22:00'
];

export default function VenueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [venue, setVenue] = useState<(Venue & { total_courts?: number }) | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  
  // Track booked court numbers per time slot: { "14:00": [1, 2], "15:00": [3] }
  const [slotMap, setSlotMap] = useState<Record<string, number[]>>({}); 
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  // 1. Fetch Venue Details from Supabase
  useEffect(() => {
    async function fetchVenue() {
      const { data, error } = await supabase
        .from("venues")
        .select("*")
        .eq("id", id)
        .single();

      if (!error && data) setVenue(data);
    }
    fetchVenue();
  }, [id]);

  // 2. Fetch Existing Bookings for Selected Date
  useEffect(() => {
    async function fetchBookings() {
      const { data } = await supabase
        .from("bookings")
        .select("start_time, court_number")
        .eq("venue_id", id)
        .eq("booking_date", selectedDate);

      if (data) {
        // Group booked court numbers by time slot
        const map: Record<string, number[]> = {};
        data.forEach((booking) => {
          if (!map[booking.start_time]) map[booking.start_time] = [];
          map[booking.start_time].push(booking.court_number);
        });
        setSlotMap(map);
      }
    }
    fetchBookings();
  }, [id, selectedDate]);

  const totalCourts = venue?.total_courts || 1;

  // 3. Handle Court Booking
  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot || !venue) return;

    const bookedCourtsForSlot = slotMap[selectedSlot] || [];
    
    // Find first available court number (1 through totalCourts)
    let assignedCourt = -1;
    for (let c = 1; c <= totalCourts; c++) {
      if (!bookedCourtsForSlot.includes(c)) {
        assignedCourt = c;
        break;
      }
    }

    if (assignedCourt === -1) {
      setMessage({ text: "All courts are fully booked for this time slot!", error: true });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    const { error } = await supabase.from("bookings").insert([
      {
        venue_id: id,
        court_number: assignedCourt,
        user_name: userName,
        user_email: userEmail,
        booking_date: selectedDate,
        start_time: selectedSlot,
      },
    ]);

    setIsSubmitting(false);

    if (error) {
      if (error.code === "23505") {
        setMessage({ text: "That court was just reserved! Please try selecting another slot.", error: true });
      } else {
        setMessage({ text: error.message, error: true });
      }
    } else {
      setMessage({ text: `Court #${assignedCourt} booked successfully!` });
      
      // Instantly update UI state without re-fetching
      setSlotMap((prev) => ({
        ...prev,
        [selectedSlot]: [...(prev[selectedSlot] || []), assignedCourt],
      }));

      setSelectedSlot(null);
      setUserName("");
      setUserEmail("");
    }
  };

  if (!venue) {
    return <main className="max-w-4xl mx-auto p-8">Loading venue details...</main>;
  }

  return (
    <main className="max-w-4xl mx-auto p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column: Venue Details */}
        <div>
          <img
            src={venue.image_url || "https://via.placeholder.com/600x400"}
            alt={venue.name}
            className="w-full h-64 object-cover rounded-xl shadow-sm mb-4"
          />
          <span className="text-xs font-semibold uppercase text-blue-600 tracking-wider">
            {venue.sport}
          </span>
          <h1 className="text-3xl font-bold mt-1">{venue.name}</h1>
          <p className="text-gray-600 mt-1">{venue.location}</p>
          <p className="text-sm text-gray-500 mt-1 font-medium">
            Facility Capacity: {totalCourts} {totalCourts === 1 ? 'Court' : 'Courts'}
          </p>
          <p className="text-2xl font-bold text-black mt-4">
            ฿{venue.price_per_hour} <span className="text-sm font-normal text-gray-500">/ hour</span>
          </p>
          {venue.description && <p className="text-gray-700 mt-4 leading-relaxed">{venue.description}</p>}
        </div>

        {/* Right Column: Dynamic Booking Form */}
        <div className="border p-6 rounded-2xl bg-gray-50 shadow-sm">
          <h2 className="text-xl font-bold mb-4">Book a Court Slot</h2>

          {message && (
            <div className={`p-3 rounded-lg mb-4 text-sm ${message.error ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleBooking} className="space-y-4">
            {/* Date Selection */}
            <div>
              <label className="block text-sm font-medium mb-1">Select Date</label>
              <input
                type="date"
                value={selectedDate}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full p-2 border rounded-lg bg-white"
                required
              />
            </div>

            {/* Time Slot Picker */}
            <div>
              <label className="block text-sm font-medium mb-2">Select Time</label>
              <div className="grid grid-cols-2 gap-2">
                {AVAILABLE_SLOTS.map((slot) => {
                  const bookedCourts = slotMap[slot] || [];
                  const remainingCourts = totalCourts - bookedCourts.length;
                  const isFullyBooked = remainingCourts <= 0;
                  const isSelected = selectedSlot === slot;

                  return (
                    <button
                      key={slot}
                      type="button"
                      disabled={isFullyBooked}
                      onClick={() => setSelectedSlot(slot)}
                      className={`p-3 text-left rounded-lg border transition ${
                        isFullyBooked
                          ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                          : isSelected
                          ? "bg-black text-white border-black"
                          : "bg-white text-gray-800 hover:border-gray-400"
                      }`}
                    >
                      <div className="font-semibold text-sm">{slot}</div>
                      <div className={`text-xs mt-1 ${isSelected ? "text-gray-200" : isFullyBooked ? "text-gray-400" : "text-green-600"}`}>
                        {isFullyBooked ? "Fully Booked" : `${remainingCourts} ${remainingCourts === 1 ? "court" : "courts"} left`}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* User Info Inputs */}
            <div>
              <label className="block text-sm font-medium mb-1">Full Name</label>
              <input
                type="text"
                placeholder="Jane Doe"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full p-2 border rounded-lg bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Email Address</label>
              <input
                type="email"
                placeholder="jane@example.com"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                className="w-full p-2 border rounded-lg bg-white"
                required
              />
            </div>

            <button
              type="submit"
              disabled={!selectedSlot || isSubmitting}
              className="w-full bg-black text-white font-medium py-3 rounded-lg hover:bg-gray-800 disabled:bg-gray-300 transition"
            >
              {isSubmitting ? "Confirming..." : "Confirm Booking"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}