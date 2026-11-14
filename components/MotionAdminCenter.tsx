'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, ShieldCheck, RefreshCw, Trash2, Building2, Clock } from 'lucide-react';
import { partnerService } from '@/lib/services/partnerService';

const MOTION_EMPLOYEE_EMAILS = [
  'mingtan0403@gmail.com',
  'motionsportsapp@gmail.com',
  'kvorakijkamjorn@gmail.com'
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
    if (!confirm(`Are you sure you want to delete active venue "${venueName}" and reset the application for testing?`)) {
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
        <button onClick={onBack} className="mb-6 flex items-center gap-2 text-sm font-bold text-black/55 hover:text-black">
          <ArrowLeft size={17} /> Back
        </button>
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8 shadow-sm">
          <ShieldCheck className="mx-auto text-red-600" size={40} />
          <h1 className="mt-4 text-2xl font-black text-red-950">Access Restricted</h1>
          <p className="mt-2 text-xs text-red-800 leading-5">
            The Motion Affiliation Requester Center is strictly reserved for Motion team members.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto min-h-[80vh] max-w-5xl px-5 py-10 lg:px-8 lg:py-14">
      <button onClick={onBack} className="mb-6 flex items-center gap-2 text-sm font-bold text-black/55 hover:text-black">
        <ArrowLeft size={17} /> Back to dashboard
      </button>

      <div className="flex flex-col gap-4 border-b border-black/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="rounded-full bg-[#101310] px-3 py-1 text-[10px] font-black text-[#d8ff3e]">
            INTERNAL HQ ONLY
          </span>
          <h1 className="mt-2 text-3xl font-black text-black">Motion HQ Control Center</h1>
          <p className="mt-1 text-xs text-black/55">Manage venue approvals and clear test venue records.</p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-black/15 bg-white px-4 py-2 text-xs font-bold shadow-xs hover:bg-black/5 transition"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="mt-6 flex border-b border-black/10 text-xs font-bold">
        <button
          onClick={() => setActiveTab('applications')}
          className={`pb-3 px-4 ${
            activeTab === 'applications'
              ? 'border-b-2 border-black text-black'
              : 'text-black/40 hover:text-black/70'
          }`}
        >
          Pending Applications ({applications.length})
        </button>
        <button
          onClick={() => setActiveTab('active_venues')}
          className={`pb-3 px-4 ${
            activeTab === 'active_venues'
              ? 'border-b-2 border-black text-black'
              : 'text-black/40 hover:text-black/70'
          }`}
        >
          Active Venues ({venues.length})
        </button>
      </div>

      {/* Tab Content */}
      <div className="mt-6 space-y-4">
        {loading ? (
          <div className="p-12 text-center text-xs font-bold text-black/40">Loading data...</div>
        ) : activeTab === 'applications' ? (
          applications.length > 0 ? (
            applications.map((app) => {
              // Target email fallback resolution
              const targetEmail = app.applicant_email || app.email || app.user_email;

              return (
                <div
                  key={app.id}
                  className="flex flex-col gap-4 rounded-2xl border border-black/10 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-[#81971d]">
                        {app.sport}
                      </span>
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[9px] font-black uppercase text-amber-800">
                        {app.status ? app.status.replace('_', ' ') : 'PENDING'}
                      </span>
                    </div>
                    <h3 className="mt-1 text-xl font-black text-black">{app.name}</h3>
                    <p className="text-xs text-black/60">
                      {app.area} · {app.address} · {app.total_courts} Courts @ ฿{app.price}/hr
                    </p>
                    {targetEmail ? (
                      <p className="mt-1 text-[11px] font-semibold text-black/40">
                        Applicant: {targetEmail}
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px] font-semibold text-red-400">
                        No email recorded on application
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 border-t border-black/10 pt-3 sm:border-0 sm:pt-0">
                    <button
                      disabled={actionId === app.id}
                      onClick={() => handleApprove(app.id, targetEmail, app.name)}
                      className="rounded-full bg-[#d8ff3e] px-5 py-2.5 text-xs font-black text-black hover:bg-[#c9f02e] disabled:opacity-50"
                    >
                      {actionId === app.id ? 'Publishing...' : 'Approve & Publish'}
                    </button>
                    <button
                      disabled={actionId === app.id}
                      onClick={() => handleReject(app.id)}
                      className="rounded-full border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-100 disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-black/20 p-12 text-center text-xs font-bold text-black/40">
              No pending venue applications found.
            </div>
          )
        ) : (
          /* Active Venues Tab */
          venues.length > 0 ? (
            venues.map((venue) => (
              <div
                key={venue.id}
                className="flex flex-col gap-4 rounded-2xl border border-black/10 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#81971d]">
                      {venue.sport}
                    </span>
                    <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-[9px] font-black uppercase text-green-700">
                      Active Venue
                    </span>
                  </div>
                  <h3 className="mt-1 text-xl font-black text-black">{venue.name}</h3>
                  <p className="text-xs text-black/60">
                    {venue.area} · {venue.address} · {venue.total_courts} Courts @ ฿{venue.price_per_hour || venue.price}/hr
                  </p>
                  <p className="mt-1 text-[11px] font-mono text-black/40">
                    Owner ID: {venue.owner_id || 'N/A'}
                  </p>
                </div>

                <button
                  disabled={actionId === venue.id}
                  onClick={() => handleDeleteVenue(venue.id, venue.owner_id, venue.name)}
                  className="flex items-center justify-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-100 disabled:opacity-50"
                >
                  <Trash2 size={15} /> Delete Venue & Reset Account
                </button>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-black/20 p-12 text-center text-xs font-bold text-black/40">
              No active venues found in database.
            </div>
          )
        )}
      </div>
    </section>
  );
}