'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  ShieldCheck,
  RefreshCw,
  Trash2,
  Search,
  X,
} from 'lucide-react';
import { partnerService } from '@/lib/services/partnerService';

const MOTION_EMPLOYEE_EMAILS = [
  'mingtan0403@gmail.com',
  'motionsportsapp@gmail.com',
  'kvorakijkamjorn@gmail.com',
];

export default function MotionAdminCenter({
  user,
  onBack,
  onVenueApproved,
}: {
  user: any;
  onBack: () => void;
  onVenueApproved: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'applications' | 'active_venues'>('applications');
  const [applications, setApplications] = useState<any[]>([]);
  const [venues, setVenues] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const isMotionEmployee =
    user?.email &&
    (MOTION_EMPLOYEE_EMAILS.includes(user.email.toLowerCase()) ||
      user?.user_metadata?.is_motion_admin === true);

  useEffect(() => {
    if (isMotionEmployee) {
      loadData();
    }
  }, [isMotionEmployee]);

  async function loadData() {
    setLoading(true);
    try {
      const [appsData, venuesData] = await Promise.all([
        partnerService.getPendingVenueApplications(),
        partnerService.getAllVenues(),
      ]);

      setApplications(appsData || []);
      setVenues(venuesData || []);
    } catch (err) {
      console.error('Failed to load control center data:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredApplications = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return applications;

    return applications.filter((app) => {
      const name = String(app.name || '').toLowerCase();
      const venueId = String(app.id || '').toLowerCase();
      const ownerId = String(app.owner_id || app.user_id || '').toLowerCase();
      return name.includes(q) || venueId.includes(q) || ownerId.includes(q);
    });
  }, [applications, searchQuery]);

  const filteredVenues = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return venues;

    return venues.filter((venue) => {
      const name = String(venue.name || '').toLowerCase();
      const venueId = String(venue.id || '').toLowerCase();
      const ownerId = String(venue.owner_id || venue.user_id || '').toLowerCase();
      return name.includes(q) || venueId.includes(q) || ownerId.includes(q);
    });
  }, [venues, searchQuery]);

  const handleApprove = async (
    appId: string,
    applicantEmail?: string,
    venueName?: string
  ) => {
    setActionId(appId);
    try {
      const res = await partnerService.approveVenueApplication(appId);

      if (res.success) {
        if (applicantEmail) {
          console.log('Sending approval email to:', applicantEmail);

          const emailRes = await fetch('/api/send-approval-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: applicantEmail,
              venueName: venueName || 'Your Venue',
            }),
          });

          const emailData = await emailRes.json();
          console.log('Email API Result:', emailData);

          if (!emailRes.ok) {
            alert(`Approved, but email dispatch failed: ${emailData.error}`);
          }
        } else {
          alert('Approved venue, but no applicant email was found on this record to notify.');
        }

        onVenueApproved();
        await loadData();
      } else {
        alert(res.error || 'Failed to approve application.');
      }
    } catch (err: any) {
      console.error('Error approving application:', err);
      alert(`Approval error: ${err.message}`);
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionId(id);
    await partnerService.rejectVenueApplication(id);
    setActionId(null);
    await loadData();
  };

  const handleDeleteVenue = async (venueId: string, ownerId: string, venueName: string) => {
    if (
      !confirm(
        `Are you sure you want to delete active venue "${venueName}" and reset the application for testing?`
      )
    ) {
      return;
    }

    setActionId(venueId);
    try {
      const res = await partnerService.deleteVenueAndResetUser(venueId, ownerId);
      if (res.success) {
        setVenues((prev) => prev.filter((v) => v.id !== venueId));
        await loadData();
      } else {
        alert(`Delete failed: ${res.error}`);
      }
    } catch (err: any) {
      console.error('Error deleting venue:', err);
      alert(`Error deleting venue: ${err.message}`);
    } finally {
      setActionId(null);
    }
  };

  if (!isMotionEmployee) {
    return (
      <section className="mx-auto min-h-[70vh] max-w-2xl px-5 py-16 text-center">
        <button
          onClick={onBack}
          className="mb-6 flex items-center gap-2 text-sm font-bold text-black/55 dark:text-[#F7F8F4]/60 hover:text-black dark:hover:text-[#F7F8F4]"
        >
          <ArrowLeft size={17} /> Back
        </button>
        <div className="rounded-3xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-8 shadow-sm">
          <ShieldCheck className="mx-auto text-red-600 dark:text-red-400" size={40} />
          <h1 className="mt-4 text-2xl font-black text-red-950 dark:text-red-200">Access Restricted</h1>
          <p className="mt-2 text-xs text-red-800 dark:text-red-300 leading-5">
            The Motion Affiliation Requester Center is strictly reserved for Motion team members.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto min-h-[80vh] max-w-5xl px-5 py-10 lg:px-8 lg:py-14">
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-sm font-bold text-black/55 dark:text-[#F7F8F4]/60 hover:text-black dark:hover:text-[#F7F8F4]"
      >
        <ArrowLeft size={17} /> Back to dashboard
      </button>

      <div className="flex flex-col gap-4 border-b border-black/10 dark:border-white/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="rounded-full bg-[#101310] dark:bg-[#d8ff3e] px-3 py-1 text-[10px] font-black text-[#d8ff3e] dark:text-[#101310]">
            INTERNAL HQ ONLY
          </span>
          <h1 className="mt-2 text-3xl font-black text-[#101310] dark:text-[#F7F8F4]">Motion HQ Control Center</h1>
          <p className="mt-1 text-xs text-black/55 dark:text-[#F7F8F4]/60">
            Manage venue approvals and clear test venue records.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-black/15 dark:border-white/10 bg-white dark:bg-[#16171A] px-4 py-2 text-xs font-bold text-[#101310] dark:text-[#F7F8F4] shadow-xs hover:bg-black/5 dark:hover:bg-white/10 transition"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Search Bar */}
      <div className="mt-6">
        <label className="flex items-center gap-3 rounded-2xl border border-black/15 dark:border-white/10 bg-white dark:bg-[#16171A] px-4 py-3 shadow-xs focus-within:border-black dark:focus-within:border-[#d8ff3e]">
          <Search size={16} className="shrink-0 text-black/40 dark:text-[#F7F8F4]/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by venue name, venue ID, or owner ID..."
            className="min-w-0 flex-1 bg-transparent text-xs font-medium text-[#101310] dark:text-[#F7F8F4] outline-none placeholder:text-black/40 dark:placeholder:text-[#F7F8F4]/40"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="rounded-full p-1 text-black/40 dark:text-[#F7F8F4]/40 hover:bg-black/5 dark:hover:bg-white/10 hover:text-black dark:hover:text-[#F7F8F4]"
            >
              <X size={14} />
            </button>
          )}
        </label>
      </div>

      {/* Navigation Tabs */}
      <div className="mt-6 flex border-b border-black/10 dark:border-white/10 text-xs font-bold">
        <button
          onClick={() => setActiveTab('applications')}
          className={`pb-3 px-4 ${
            activeTab === 'applications'
              ? 'border-b-2 border-black dark:border-[#d8ff3e] text-[#101310] dark:text-[#d8ff3e]'
              : 'text-black/40 dark:text-[#F7F8F4]/50 hover:text-black/70 dark:hover:text-[#F7F8F4]'
          }`}
        >
          Pending Applications ({filteredApplications.length})
        </button>
        <button
          onClick={() => setActiveTab('active_venues')}
          className={`pb-3 px-4 ${
            activeTab === 'active_venues'
              ? 'border-b-2 border-black dark:border-[#d8ff3e] text-[#101310] dark:text-[#d8ff3e]'
              : 'text-black/40 dark:text-[#F7F8F4]/50 hover:text-black/70 dark:hover:text-[#F7F8F4]'
          }`}
        >
          Active Venues ({filteredVenues.length})
        </button>
      </div>

      {/* Tab Content */}
      <div className="mt-6 space-y-4">
        {loading ? (
          <div className="p-12 text-center text-xs font-bold text-black/40 dark:text-[#F7F8F4]/50">Loading data...</div>
        ) : activeTab === 'applications' ? (
          filteredApplications.length > 0 ? (
            filteredApplications.map((app) => {
              const targetEmail = app.applicant_email || app.email || app.user_email;
              const ownerId = app.owner_id || app.user_id || 'N/A';

              return (
                <div
                  key={app.id}
                  className="flex flex-col gap-4 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#16171A] p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-[#81971d] dark:text-[#d8ff3e]">
                        {app.sport}
                      </span>
                      <span className="rounded-full bg-amber-100 dark:bg-amber-500/20 px-2.5 py-0.5 text-[9px] font-black uppercase text-amber-800 dark:text-amber-300">
                        {app.status ? app.status.replace('_', ' ') : 'PENDING'}
                      </span>
                    </div>
                    <h3 className="mt-1 text-xl font-black text-[#101310] dark:text-[#F7F8F4]">{app.name}</h3>
                    <p className="mt-0.5 font-mono text-xs text-black/60 dark:text-[#F7F8F4]/60">
                      Venue ID: {app.id} · Owner ID: {ownerId}
                    </p>
                    <p className="mt-1 text-[11px] text-black/40 dark:text-[#F7F8F4]/50">
                      {app.area} · {app.address} · {app.total_courts} Courts @ ฿{app.price}/hr
                    </p>
                    {targetEmail ? (
                      <p className="mt-1 text-[11px] font-semibold text-black/40 dark:text-[#F7F8F4]/50">
                        Applicant: {targetEmail}
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px] font-semibold text-red-400">
                        No email recorded on application
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 border-t border-black/10 dark:border-white/10 pt-3 sm:border-0 sm:pt-0">
                    <button
                      disabled={actionId === app.id}
                      onClick={() => handleApprove(app.id, targetEmail, app.name)}
                      className="rounded-full bg-[#d8ff3e] px-5 py-2.5 text-xs font-black text-[#101310] hover:bg-[#c9f02e] disabled:opacity-50"
                    >
                      {actionId === app.id ? 'Publishing...' : 'Approve & Publish'}
                    </button>
                    <button
                      disabled={actionId === app.id}
                      onClick={() => handleReject(app.id)}
                      className="rounded-full border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/15 px-4 py-2.5 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/25 disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-black/20 dark:border-white/15 bg-transparent dark:bg-[#16171A] p-12 text-center text-xs font-bold text-black/40 dark:text-[#F7F8F4]/50">
              {searchQuery
                ? `No pending applications matching "${searchQuery}".`
                : 'No pending venue applications found.'}
            </div>
          )
        ) : filteredVenues.length > 0 ? (
          filteredVenues.map((venue) => {
            const ownerId = venue.owner_id || venue.user_id || 'N/A';

            return (
              <div
                key={venue.id}
                className="flex flex-col gap-4 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#16171A] p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#81971d] dark:text-[#d8ff3e]">
                      {venue.sport}
                    </span>
                    <span className="rounded-full bg-green-100 dark:bg-green-500/20 px-2.5 py-0.5 text-[9px] font-black uppercase text-green-700 dark:text-green-300">
                      Active Venue
                    </span>
                  </div>
                  <h3 className="mt-1 text-xl font-black text-[#101310] dark:text-[#F7F8F4]">{venue.name}</h3>
                  <p className="mt-0.5 font-mono text-xs text-black/60 dark:text-[#F7F8F4]/60">
                    Venue ID: {venue.id} · Owner ID: {ownerId}
                  </p>
                  <p className="mt-1 text-[11px] text-black/40 dark:text-[#F7F8F4]/50">
                    {venue.area} · {venue.address} · {venue.total_courts} Courts @ ฿
                    {venue.price_per_hour || venue.price}/hr
                  </p>
                </div>

                <button
                  disabled={actionId === venue.id}
                  onClick={() => handleDeleteVenue(venue.id, ownerId, venue.name)}
                  className="flex items-center justify-center gap-1.5 rounded-full border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/15 px-4 py-2.5 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/25 disabled:opacity-50"
                >
                  <Trash2 size={15} /> Delete Venue & Reset Account
                </button>
              </div>
            );
          })
        ) : (
          <div className="rounded-2xl border border-dashed border-black/20 dark:border-white/15 bg-transparent dark:bg-[#16171A] p-12 text-center text-xs font-bold text-black/40 dark:text-[#F7F8F4]/50">
            {searchQuery
              ? `No active venues matching "${searchQuery}".`
              : 'No active venues found in database.'}
          </div>
        )}
      </div>
    </section>
  );
}