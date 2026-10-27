'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, ShieldCheck, CheckCircle2, XCircle, Building2, Clock } from 'lucide-react';
import { partnerService } from '@/lib/services/partnerService';

// List of authorized Motion employee emails
const MOTION_EMPLOYEE_EMAILS = [
  'ming@motion.app', // Update with your actual emails
  'admin@motion.app',
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
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const isMotionEmployee =
    user?.email &&
    (MOTION_EMPLOYEE_EMAILS.includes(user.email.toLowerCase()) ||
      user?.user_metadata?.is_motion_admin === true);

  useEffect(() => {
    if (isMotionEmployee) {
      loadApplications();
    }
  }, [isMotionEmployee]);

  async function loadApplications() {
    setLoading(true);
    const data = await partnerService.getPendingVenueApplications();
    setApplications(data);
    setLoading(false);
  }

  const handleApprove = async (id: string) => {
    setActionId(id);
    const res = await partnerService.approveVenueApplication(id);
    setActionId(null);

    if (res.success) {
      await loadApplications();
      onVenueApproved(); // Refresh live venue discovery list
    } else {
      alert('Failed to approve venue: ' + res.error);
    }
  };

  const handleReject = async (id: string) => {
    setActionId(id);
    await partnerService.rejectVenueApplication(id);
    setActionId(null);
    await loadApplications();
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

      <div className="flex items-center justify-between border-b border-black/10 pb-6">
        <div>
          <span className="rounded-full bg-[#101310] px-3 py-1 text-[10px] font-black text-[#d8ff3e]">
            INTERNAL HQ ONLY
          </span>
          <h1 className="mt-2 text-3xl font-black text-black">Motion Affiliation Requester Center</h1>
          <p className="mt-1 text-xs text-black/55">Review and authorize incoming venue partnership submissions.</p>
        </div>
      </div>

      <div className="mt-8 space-y-4">
        {loading ? (
          <div className="p-12 text-center text-xs font-bold text-black/40">Loading applications...</div>
        ) : applications.length > 0 ? (
          applications.map((app) => (
            <div
              key={app.id}
              className="flex flex-col gap-4 rounded-2xl border border-black/10 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#81971d]">
                    {app.sport}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase ${
                      app.status === 'approved'
                        ? 'bg-green-100 text-green-700'
                        : app.status === 'rejected'
                        ? 'bg-red-100 text-red-600'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {app.status.replace('_', ' ')}
                  </span>
                </div>
                <h3 className="mt-1 text-xl font-black text-black">{app.name}</h3>
                <p className="text-xs text-black/60">
                  {app.area} · {app.address} · {app.total_courts} Courts @ ฿{app.price}/hr
                </p>
                {app.description && <p className="mt-2 text-xs italic text-black/70">"{app.description}"</p>}
              </div>

              <div className="flex items-center gap-2 border-t border-black/10 pt-3 sm:border-0 sm:pt-0">
                {app.status === 'pending_motion_approval' ? (
                  <>
                    <button
                      disabled={actionId === app.id}
                      onClick={() => handleApprove(app.id)}
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
                  </>
                ) : (
                  <span className="text-xs font-bold text-black/40">Processed</span>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-black/20 p-12 text-center text-xs font-bold text-black/40">
            No venue applications currently awaiting review.
          </div>
        )}
      </div>
    </section>
  );
}