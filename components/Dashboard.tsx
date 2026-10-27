'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  UserCheck,
  Building2,
  Users,
  Settings,
  XCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { adminService } from '@/lib/services/adminService';
import type { Booking } from '@/lib/services/bookingService';
import type { Venue, Coach } from '@/lib/data';

const money = (n: number) => `฿${n.toLocaleString('en-US')}`;

export default function Dashboard({
  bookings,
  venues,
  user,
  onBack,
  onCancel,
}: {
  bookings: Booking[];
  venues: Venue[];
  user?: any;
  onBack: () => void;
  onCancel: (id: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<'venue' | 'coach'>('venue');
  
  // Coach state
  const [coachProfile, setCoachProfile] = useState<Coach | null>(null);
  const [coachForm, setCoachForm] = useState({
    full_name: '',
    sport: 'Badminton',
    hourly_rate: 500,
    location: 'Bangkok',
    bio: '',
  });
  const [savingCoach, setSavingCoach] = useState(false);
  const [coachMsg, setCoachMsg] = useState('');

  // Determine user roles from user_metadata
  const isVenueOwner =
    user?.user_metadata?.role === 'venue_owner' || user?.user_metadata?.is_approved_venue === true;
  const isCoach =
    user?.user_metadata?.role === 'coach' || user?.user_metadata?.is_approved_coach === true;

  useEffect(() => {
    if (user?.id) {
      adminService.getCoachProfile(user.id).then((profile) => {
        if (profile) {
          setCoachProfile(profile);
          setCoachForm({
            full_name: profile.full_name || '',
            sport: profile.sport || 'Badminton',
            hourly_rate: profile.hourly_rate || 500,
            location: profile.location || 'Bangkok',
            bio: profile.bio || '',
          });
        }
      });
    }
  }, [user]);

  // Analytics Calculations
  const analytics = useMemo(() => {
    const activeBookings = bookings.filter((b) => b.status === 'Confirmed');
    const totalRevenue = activeBookings.reduce((sum, b) => sum + (b.price || 0), 0);
    const totalBookings = bookings.length;

    return {
      totalRevenue,
      totalBookings,
      confirmedCount: activeBookings.length,
      cancelledCount: bookings.filter((b) => b.status === 'Cancelled').length,
    };
  }, [bookings]);

  const handleSaveCoachProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSavingCoach(true);
    setCoachMsg('');

    const res = await adminService.saveCoachProfile({
      user_id: user.id,
      full_name: coachForm.full_name || user.user_metadata?.full_name || 'Coach',
      sport: coachForm.sport,
      hourly_rate: Number(coachForm.hourly_rate),
      location: coachForm.location,
      bio: coachForm.bio,
      contact_email: user.email,
      is_active: true,
    });

    setSavingCoach(false);
    if (res.success) {
      setCoachMsg('Coach profile updated successfully!');
    } else {
      setCoachMsg(res.error || 'Failed to update coach profile.');
    }
  };

  return (
    <section className="mx-auto min-h-[80vh] max-w-6xl px-5 py-10 lg:px-8 lg:py-14">
      {/* Top Header */}
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-sm font-bold text-black/55 hover:text-black transition"
      >
        <ArrowLeft size={17} /> Back to main site
      </button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-black/10 pb-6">
        <div>
          <p className="text-xs font-black uppercase tracking-[.2em] text-[#81971d]">
            PARTNER DASHBOARD
          </p>
          <h1 className="mt-1 text-4xl font-black tracking-tight text-black">Control Centre</h1>
          <p className="mt-1 text-sm text-black/55">
            Manage your court reservations, active listings, and coaching schedules.
          </p>
        </div>

        {/* Toggle Switch */}
        <div className="flex gap-2 rounded-2xl bg-[#f2f4ed] p-1.5 border border-black/10 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('venue')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition ${
              activeTab === 'venue'
                ? 'bg-[#101310] text-[#d8ff3e] shadow-sm'
                : 'text-black/60 hover:text-black'
            }`}
          >
            <Building2 size={15} /> Venue Owner
          </button>
          <button
            onClick={() => setActiveTab('coach')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition ${
              activeTab === 'coach'
                ? 'bg-[#101310] text-[#d8ff3e] shadow-sm'
                : 'text-black/60 hover:text-black'
            }`}
          >
            <Users size={15} /> Coach Portal
          </button>
        </div>
      </div>

      {/* TAB 1: VENUE OWNER CONTROLS */}
      {activeTab === 'venue' && (
        <div className="mt-8 space-y-8">
          {/* Overview Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-black/10 bg-white p-5">
              <div className="flex items-center justify-between text-black/50">
                <span className="text-xs font-bold uppercase">Total Revenue</span>
                <DollarSign size={18} className="text-[#81971d]" />
              </div>
              <p className="mt-2 text-3xl font-black text-black">{money(analytics.totalRevenue)}</p>
            </div>

            <div className="rounded-2xl border border-black/10 bg-white p-5">
              <div className="flex items-center justify-between text-black/50">
                <span className="text-xs font-bold uppercase">Active Bookings</span>
                <CheckCircle2 size={18} className="text-[#81971d]" />
              </div>
              <p className="mt-2 text-3xl font-black text-black">{analytics.confirmedCount}</p>
            </div>

            <div className="rounded-2xl border border-black/10 bg-white p-5">
              <div className="flex items-center justify-between text-black/50">
                <span className="text-xs font-bold uppercase">Cancellations</span>
                <XCircle size={18} className="text-red-500" />
              </div>
              <p className="mt-2 text-3xl font-black text-black">{analytics.cancelledCount}</p>
            </div>

            <div className="rounded-2xl border border-black/10 bg-white p-5">
              <div className="flex items-center justify-between text-black/50">
                <span className="text-xs font-bold uppercase">Venues Listed</span>
                <Building2 size={18} className="text-black/40" />
              </div>
              <p className="mt-2 text-3xl font-black text-black">{venues.length}</p>
            </div>
          </div>

          {/* Bookings Management Table */}
          <div className="rounded-2xl border border-black/10 bg-white overflow-hidden shadow-sm">
            <div className="border-b border-black/10 px-6 py-4 bg-[#f7f8f4]">
              <h2 className="text-base font-extrabold text-black">Master Reservation List</h2>
            </div>

            {bookings.length > 0 ? (
              <div className="divide-y divide-black/5 overflow-x-auto">
                {bookings.map((b) => (
                  <div key={b.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-[#81971d]">{b.sport}</span>
                        <span className="font-mono text-xs text-black/40">Ref: {b.id}</span>
                      </div>
                      <p className="font-extrabold text-black text-base">{b.venue}</p>
                      <p className="text-xs text-black/50 mt-0.5">{b.date} · {b.time}</p>
                    </div>

                    <div className="flex items-center gap-4">
                      <span
                        className={`rounded-full px-3 py-1 text-[10px] font-black ${
                          b.status === 'Cancelled'
                            ? 'bg-red-100 text-red-600'
                            : 'bg-[#edf5d2] text-[#5d7112]'
                        }`}
                      >
                        {b.status}
                      </span>
                      <b className="text-sm">{money(b.price)}</b>

                      {b.status === 'Confirmed' && (
                        <button
                          onClick={() => onCancel(b.id)}
                          className="text-xs font-bold text-red-600 hover:underline"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-10 text-center text-sm font-semibold text-black/40">
                No court bookings recorded yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: COACH PORTAL */}
      {activeTab === 'coach' && (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.2fr]">
          {/* Coach Profile Config */}
          <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-black text-black flex items-center gap-2">
              <Settings size={18} /> Coach Profile Settings
            </h2>
            <p className="mt-1 text-xs text-black/50">
              Set your hourly rate and sport specialities visible to players looking for training.
            </p>

            <form onSubmit={handleSaveCoachProfile} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-black/60 uppercase">Full Name</label>
                <input
                  type="text"
                  required
                  value={coachForm.full_name}
                  onChange={(e) => setCoachForm({ ...coachForm, full_name: e.target.value })}
                  placeholder="e.g. Coach Alex"
                  className="mt-1 w-full rounded-xl border border-black/10 bg-[#f7f8f4] px-3 py-2 text-xs font-bold text-black outline-none focus:border-black/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-black/60 uppercase">Sport</label>
                  <select
                    value={coachForm.sport}
                    onChange={(e) => setCoachForm({ ...coachForm, sport: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-black/10 bg-[#f7f8f4] px-3 py-2 text-xs font-bold text-black outline-none"
                  >
                    <option>Badminton</option>
                    <option>Tennis</option>
                    <option>Basketball</option>
                    <option>Futsal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-black/60 uppercase">Hourly Rate (฿)</label>
                  <input
                    type="number"
                    required
                    min={100}
                    value={coachForm.hourly_rate}
                    onChange={(e) => setCoachForm({ ...coachForm, hourly_rate: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-black/10 bg-[#f7f8f4] px-3 py-2 text-xs font-bold text-black outline-none focus:border-black/30"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-black/60 uppercase">Primary Location</label>
                <input
                  type="text"
                  required
                  value={coachForm.location}
                  onChange={(e) => setCoachForm({ ...coachForm, location: e.target.value })}
                  placeholder="e.g. Sukhumvit / Rama 9"
                  className="mt-1 w-full rounded-xl border border-black/10 bg-[#f7f8f4] px-3 py-2 text-xs font-bold text-black outline-none focus:border-black/30"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-black/60 uppercase">Bio & Experience</label>
                <textarea
                  rows={3}
                  value={coachForm.bio}
                  onChange={(e) => setCoachForm({ ...coachForm, bio: e.target.value })}
                  placeholder="Describe your training style, qualifications, and achievements..."
                  className="mt-1 w-full rounded-xl border border-black/10 bg-[#f7f8f4] p-3 text-xs text-black outline-none focus:border-black/30"
                />
              </div>

              {coachMsg && (
                <p className={`text-xs font-bold ${coachMsg.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
                  {coachMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={savingCoach}
                className="w-full rounded-full bg-[#d8ff3e] py-3 text-xs font-black text-black transition hover:bg-[#c9f02e] disabled:opacity-50"
              >
                {savingCoach ? 'Saving Profile...' : 'Update Coach Profile'}
              </button>
            </form>
          </div>

          {/* Coach Status Card */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-black text-black flex items-center gap-2">
                <UserCheck size={18} className="text-[#81971d]" /> Active Status
              </h2>
              <div className="mt-4 flex items-center justify-between rounded-xl bg-[#eef7cf] p-4 text-xs">
                <div>
                  <p className="font-extrabold text-[#526410]">Verified Coach Status</p>
                  <p className="text-[11px] text-[#526410]/80">Your profile is visible to players in discovery.</p>
                </div>
                <span className="rounded-full bg-[#d8ff3e] px-3 py-1 text-[10px] font-black text-black">ACTIVE</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}