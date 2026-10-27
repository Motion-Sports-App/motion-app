'use client';

import { useState } from 'react';
import { ArrowLeft, Building2, CheckCircle2, UserCheck, ShieldAlert, Sparkles } from 'lucide-react';
import { partnerService } from '@/lib/services/partnerService';
import type { Venue } from '@/lib/data';

export default function PartnerOnboardingView({
  user,
  venues,
  onBack,
  onAuthModalOpen,
}: {
  user: any;
  venues: Venue[];
  onBack: () => void;
  onAuthModalOpen: () => void;
}) {
  const [mode, setMode] = useState<'select' | 'venue_form' | 'coach_form' | 'success'>('select');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Venue Form
  const [venueData, setVenueData] = useState({
    name: '',
    sport: 'Badminton',
    area: 'Sukhumvit',
    address: '',
    totalCourts: 4,
    price: 350,
    description: '',
  });

  // Coach Form (Freelance by default)
  const [coachData, setCoachData] = useState({
    employmentType: 'freelance' as 'freelance' | 'venue_affiliated',
    sport: 'Badminton',
    hourlyRate: 500,
    bio: '',
    venueId: venues[0]?.id || '',
  });

  if (!user) {
    return (
      <section className="mx-auto min-h-[75vh] max-w-3xl px-5 py-12 text-center">
        <button onClick={onBack} className="mb-6 flex items-center gap-2 text-sm font-bold text-black/55 hover:text-black">
          <ArrowLeft size={17} /> Back to discovery
        </button>
        <div className="rounded-3xl border border-black/10 bg-white p-8 sm:p-12 shadow-sm">
          <ShieldAlert className="mx-auto text-[#81971d]" size={40} />
          <h1 className="mt-4 text-3xl font-black text-black">Partner with Motion</h1>
          <p className="mt-2 text-sm text-black/60">
            Please sign in or create an account to register your venue or apply as a certified coach.
          </p>
          <button
            onClick={onAuthModalOpen}
            className="mt-6 rounded-full bg-[#101310] px-8 py-3.5 text-xs font-bold text-white hover:bg-[#30372a]"
          >
            Sign In / Sign Up
          </button>
        </div>
      </section>
    );
  }

  const handleVenueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');

    const res = await partnerService.submitVenueApplication(user.id, venueData);
    setSubmitting(false);

    if (res.success) {
      setSuccessMsg('Your venue application has been submitted! Motion will review and approve your listing shortly.');
      setMode('success');
    } else {
      setErrorMsg(res.error || 'Failed to submit application.');
    }
  };

  const handleCoachSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');

    if (coachData.employmentType === 'venue_affiliated' && !coachData.venueId) {
      setErrorMsg('Please select a venue to affiliate with.');
      setSubmitting(false);
      return;
    }

    const selectedVenue = venues.find((v) => v.id === coachData.venueId);

    const res = await partnerService.submitCoachApplication(user.id, {
      coachName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Coach',
      coachEmail: user.email || '',
      sport: coachData.sport,
      hourlyRate: Number(coachData.hourlyRate),
      bio: coachData.bio,
      employmentType: coachData.employmentType,
      venueId: coachData.employmentType === 'venue_affiliated' ? coachData.venueId : undefined,
    });

    setSubmitting(false);

    if (res.success) {
      if (coachData.employmentType === 'freelance') {
        setSuccessMsg('Your freelance coach profile is live! Players can now find and book training sessions with you.');
      } else {
        setSuccessMsg(
          `Application sent! Your request to coach at ${selectedVenue?.name || 'the venue'} is now pending approval from the venue manager.`
        );
      }
      setMode('success');
    } else {
      setErrorMsg(res.error || 'Failed to submit application.');
    }
  };

  return (
    <section className="mx-auto min-h-[75vh] max-w-4xl px-5 py-10 lg:px-8 lg:py-14">
      <button onClick={onBack} className="mb-6 flex items-center gap-2 text-sm font-bold text-black/55 hover:text-black">
        <ArrowLeft size={17} /> Back to discovery
      </button>

      {mode === 'select' && (
        <div>
          <p className="text-xs font-black uppercase tracking-[.2em] text-[#81971d]">PARTNER PROGRAMME</p>
          <h1 className="mt-1 text-4xl font-black text-black">Grow your sports business.</h1>
          <p className="mt-1 text-sm text-black/55">Choose how you want to partner with Motion.</p>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div
              onClick={() => setMode('venue_form')}
              className="group cursor-pointer rounded-3xl border border-black/10 bg-white p-8 transition hover:border-black/30 hover:shadow-xl"
            >
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#eef7cf] text-[#586c12] group-hover:bg-[#d8ff3e]">
                <Building2 size={24} />
              </div>
              <h2 className="mt-5 text-2xl font-black text-black">Register a Venue</h2>
              <p className="mt-2 text-xs leading-5 text-black/60">
                List your courts, set custom time slots, track bookings, and automate reservation schedules.
              </p>
              <span className="mt-6 inline-block text-xs font-black text-[#586c12] group-hover:underline">
                Apply as Venue Owner ↗
              </span>
            </div>

            <div
              onClick={() => setMode('coach_form')}
              className="group cursor-pointer rounded-3xl border border-black/10 bg-white p-8 transition hover:border-black/30 hover:shadow-xl"
            >
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#101310] text-[#d8ff3e]">
                <UserCheck size={24} />
              </div>
              <h2 className="mt-5 text-2xl font-black text-black">Register as a Coach</h2>
              <p className="mt-2 text-xs leading-5 text-black/60">
                Register as a freelance coach or affiliate with a partner venue to receive client training sessions.
              </p>
              <span className="mt-6 inline-block text-xs font-black text-black group-hover:underline">
                Apply as Coach (Freelance or Venue) ↗
              </span>
            </div>
          </div>
        </div>
      )}

      {mode === 'venue_form' && (
        <div className="rounded-3xl border border-black/10 bg-white p-6 sm:p-10">
          <h2 className="text-2xl font-black text-black">Venue Registration</h2>
          <p className="text-xs text-black/50 mt-1">
            Provide venue details. Submissions require Motion review before going live.
          </p>

          <form onSubmit={handleVenueSubmit} className="mt-6 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-black/60 uppercase">Venue Name *</label>
                <input
                  type="text"
                  required
                  value={venueData.name}
                  onChange={(e) => setVenueData({ ...venueData, name: e.target.value })}
                  placeholder="e.g. Smash Arena Sukhumvit"
                  className="mt-1 w-full rounded-xl border border-black/10 bg-[#f7f8f4] px-3 py-2 text-xs text-black outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-black/60 uppercase">Primary Sport *</label>
                <select
                  value={venueData.sport}
                  onChange={(e) => setVenueData({ ...venueData, sport: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-[#f7f8f4] px-3 py-2 text-xs text-black outline-none"
                >
                  <option>Badminton</option>
                  <option>Tennis</option>
                  <option>Basketball</option>
                  <option>Futsal</option>
                </select>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-black/60 uppercase">Area *</label>
                <input
                  type="text"
                  required
                  value={venueData.area}
                  onChange={(e) => setVenueData({ ...venueData, area: e.target.value })}
                  placeholder="e.g. Rama 9"
                  className="mt-1 w-full rounded-xl border border-black/10 bg-[#f7f8f4] px-3 py-2 text-xs text-black outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-black/60 uppercase">Total Courts *</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={venueData.totalCourts}
                  onChange={(e) => setVenueData({ ...venueData, totalCourts: Number(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-[#f7f8f4] px-3 py-2 text-xs text-black outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-black/60 uppercase">Price per hour (฿) *</label>
                <input
                  type="number"
                  min={50}
                  required
                  value={venueData.price}
                  onChange={(e) => setVenueData({ ...venueData, price: Number(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-[#f7f8f4] px-3 py-2 text-xs text-black outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-black/60 uppercase">Address *</label>
              <input
                type="text"
                required
                value={venueData.address}
                onChange={(e) => setVenueData({ ...venueData, address: e.target.value })}
                placeholder="Full address for map placement"
                className="mt-1 w-full rounded-xl border border-black/10 bg-[#f7f8f4] px-3 py-2 text-xs text-black outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-black/60 uppercase">Description</label>
              <textarea
                rows={3}
                value={venueData.description}
                onChange={(e) => setVenueData({ ...venueData, description: e.target.value })}
                placeholder="Facilities, parking availability, air-conditioning details..."
                className="mt-1 w-full rounded-xl border border-black/10 bg-[#f7f8f4] p-3 text-xs text-black outline-none"
              />
            </div>

            {errorMsg && <p className="text-xs font-bold text-red-600">{errorMsg}</p>}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setMode('select')}
                className="rounded-full border border-black/10 px-6 py-3 text-xs font-bold text-black"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-full bg-[#d8ff3e] py-3 text-xs font-black text-black hover:bg-[#c9f02e]"
              >
                {submitting ? 'Submitting Application...' : 'Submit Venue for Review'}
              </button>
            </div>
          </form>
        </div>
      )}

      {mode === 'coach_form' && (
        <div className="rounded-3xl border border-black/10 bg-white p-6 sm:p-10">
          <h2 className="text-2xl font-black text-black">Coach Registration</h2>
          <p className="text-xs text-black/50 mt-1">Register as a freelance coach or affiliate with a partner court venue.</p>

          <form onSubmit={handleCoachSubmit} className="mt-6 space-y-4">
            {/* Employment Type Selector */}
            <div>
              <label className="block text-xs font-bold text-black/60 uppercase mb-2">Coaching Setup *</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCoachData({ ...coachData, employmentType: 'freelance' })}
                  className={`rounded-2xl border p-4 text-left transition ${
                    coachData.employmentType === 'freelance'
                      ? 'border-black bg-[#101310] text-white'
                      : 'border-black/10 bg-[#f7f8f4] text-black hover:bg-gray-100'
                  }`}
                >
                  <p className="font-extrabold text-sm">⚡ Freelance Coach</p>
                  <p className="mt-1 text-[11px] opacity-70">No venue required. Instant activation on Motion.</p>
                </button>

                <button
                  type="button"
                  onClick={() => setCoachData({ ...coachData, employmentType: 'venue_affiliated' })}
                  className={`rounded-2xl border p-4 text-left transition ${
                    coachData.employmentType === 'venue_affiliated'
                      ? 'border-black bg-[#101310] text-white'
                      : 'border-black/10 bg-[#f7f8f4] text-black hover:bg-gray-100'
                  }`}
                >
                  <p className="font-extrabold text-sm">🏟️ Venue Affiliated</p>
                  <p className="mt-1 text-[11px] opacity-70">Requires approval from partner venue manager.</p>
                </button>
              </div>
            </div>

            {/* Venue Selector (Only shown if venue_affiliated) */}
            {coachData.employmentType === 'venue_affiliated' && (
              <div>
                <label className="block text-xs font-bold text-black/60 uppercase">Select Partner Venue *</label>
                <select
                  value={coachData.venueId}
                  onChange={(e) => setCoachData({ ...coachData, venueId: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-[#f7f8f4] px-3 py-2 text-xs font-bold text-black outline-none"
                >
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.area} · {v.sport})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-black/60 uppercase">Coaching Sport *</label>
                <select
                  value={coachData.sport}
                  onChange={(e) => setCoachData({ ...coachData, sport: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-[#f7f8f4] px-3 py-2 text-xs font-bold text-black outline-none"
                >
                  <option>Badminton</option>
                  <option>Tennis</option>
                  <option>Basketball</option>
                  <option>Futsal</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-black/60 uppercase">Hourly Coaching Rate (฿) *</label>
                <input
                  type="number"
                  min={200}
                  required
                  value={coachData.hourlyRate}
                  onChange={(e) => setCoachData({ ...coachData, hourlyRate: Number(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-[#f7f8f4] px-3 py-2 text-xs text-black outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-black/60 uppercase">Bio & Experience *</label>
              <textarea
                rows={4}
                required
                value={coachData.bio}
                onChange={(e) => setCoachData({ ...coachData, bio: e.target.value })}
                placeholder="Provide your background, tournament achievements, or certified coaching levels..."
                className="mt-1 w-full rounded-xl border border-black/10 bg-[#f7f8f4] p-3 text-xs text-black outline-none"
              />
            </div>

            {errorMsg && <p className="text-xs font-bold text-red-600">{errorMsg}</p>}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setMode('select')}
                className="rounded-full border border-black/10 px-6 py-3 text-xs font-bold text-black"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-full bg-[#101310] py-3 text-xs font-black text-white hover:bg-[#30372a]"
              >
                {submitting
                  ? 'Registering...'
                  : coachData.employmentType === 'freelance'
                  ? 'Complete Freelance Registration'
                  : 'Submit Venue Approval Request'}
              </button>
            </div>
          </form>
        </div>
      )}

      {mode === 'success' && (
        <div className="rounded-3xl border border-black/10 bg-white p-8 text-center sm:p-12 shadow-sm">
          <CheckCircle2 className="mx-auto text-[#81971d]" size={48} />
          <h2 className="mt-4 text-3xl font-black text-black">Registration Complete!</h2>
          <p className="mt-2 text-sm text-black/60 max-w-md mx-auto">{successMsg}</p>
          <button
            onClick={onBack}
            className="mt-6 rounded-full bg-[#101310] px-8 py-3.5 text-xs font-bold text-white hover:bg-[#30372a]"
          >
            Return to Discovery
          </button>
        </div>
      )}
    </section>
  );
}