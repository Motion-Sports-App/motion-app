'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Check,
  ImagePlus,
  Loader2,
  Plus,
  Trash2,
  X,
  Trophy,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import DefaultAvatar from '@/components/DefaultAvatar';
import {
  profileService,
  type UserProfile,
  type SportEntry,
} from '@/lib/services/profileService';

const SPORT_OPTIONS = [
  'Badminton',
  'Tennis',
  'Padel',
  'Pickleball',
  'Basketball',
  'Football',
  'Squash',
  'Table Tennis',
];

const SKILL_LEVELS = ['Casual', 'Intermediate', 'Club', 'Competitive'] as const;
const HANDEDNESS_OPTIONS = ['Right-handed', 'Left-handed', 'Ambidextrous'] as const;
const FORMAT_OPTIONS = ['Singles', 'Doubles', 'Mixed Doubles', 'Team / 5v5'] as const;

function compressImage(
  source: File | Blob,
  maxSize = 320
): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = maxSize;
        canvas.height = maxSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas unsupported'));

        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, maxSize, maxSize);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('Blob conversion failed'));
            resolve({ blob, dataUrl });
          },
          'image/jpeg',
          0.85
        );
      };
      img.onerror = reject;
      if (typeof reader.result === 'string') img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(source);
  });
}

export default function ProfileView({
  user,
  profile,
  onProfileUpdated,
}: {
  user: any;
  profile: UserProfile | null;
  onProfileUpdated?: (updatedProfile: UserProfile) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [cameraOpen, setCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const [avatarUrl, setAvatarUrl] = useState<string>(profile?.avatar_url || '');
  const [displayName, setDisplayName] = useState<string>(
    profile?.display_name || user?.email?.split('@')[0] || ''
  );
  const [fullName, setFullName] = useState<string>(profile?.full_name || '');
  const [phone, setPhone] = useState<string>(profile?.phone || '');
  const [bio, setBio] = useState<string>(profile?.bio || '');
  const [homeArea, setHomeArea] = useState<string>(profile?.home_area || '');
  const [handedness, setHandedness] = useState<string>(
    profile?.handedness || 'Right-handed'
  );
  const [preferredFormat, setPreferredFormat] = useState<string>(
    profile?.preferred_format || 'Doubles'
  );
  const [openToMatch, setOpenToMatch] = useState<boolean>(
    profile?.open_to_match ?? true
  );
  const [sports, setSports] = useState<SportEntry[]>(
    profile?.sports && profile.sports.length > 0
      ? profile.sports
      : [{ sport: 'Badminton', level: 'Intermediate' }]
  );
  const [gearList, setGearList] = useState<string[]>(profile?.gear || []);
  const [gearInput, setGearInput] = useState('');

  useEffect(() => {
    if (!profile) return;
    setAvatarUrl(profile.avatar_url || '');
    setDisplayName(profile.display_name || user?.email?.split('@')[0] || '');
    setFullName(profile.full_name || '');
    setPhone(profile.phone || '');
    setBio(profile.bio || '');
    setHomeArea(profile.home_area || '');
    setHandedness(profile.handedness || 'Right-handed');
    setPreferredFormat(profile.preferred_format || 'Doubles');
    setOpenToMatch(profile.open_to_match ?? true);
    if (Array.isArray(profile.sports) && profile.sports.length > 0) {
      setSports(profile.sports);
    }
    if (Array.isArray(profile.gear)) {
      setGearList(profile.gear);
    }
  }, [profile, user?.email]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const processSelectedFile = async (file?: File | Blob) => {
    if (!file || !user?.id) return;
    setUploadingPhoto(true);
    try {
      const { blob, dataUrl } = await compressImage(file);
      const uploadedUrl = await profileService.uploadAvatarBlob(
        user.id,
        blob,
        dataUrl
      );
      setAvatarUrl(uploadedUrl);
    } catch {
      alert('Could not process that image. Please try another photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processSelectedFile(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processSelectedFile(file);
    }
  };

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 640 },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 50);
    } catch {
      alert(
        'Camera access was blocked or unavailable on this device. Please choose a photo from your gallery instead.'
      );
    }
  };

  const closeCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
  };

  const captureFromCamera = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 320;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const side = Math.min(video.videoWidth, video.videoHeight);
    const sx = (video.videoWidth - side) / 2;
    const sy = (video.videoHeight - side) / 2;
    ctx.drawImage(video, sx, sy, side, side, 0, 0, 320, 320);

    canvas.toBlob(
      (blob) => {
        if (blob) processSelectedFile(blob);
      },
      'image/jpeg',
      0.85
    );
    closeCamera();
  };

  const toggleSport = (sportName: string) => {
    setSports((prev) => {
      const exists = prev.some((s) => s.sport === sportName);
      if (exists) return prev.filter((s) => s.sport !== sportName);
      return [...prev, { sport: sportName, level: 'Intermediate' }];
    });
  };

  const updateSportLevel = (
    sportName: string,
    level: (typeof SKILL_LEVELS)[number]
  ) => {
    setSports((prev) =>
      prev.map((s) => (s.sport === sportName ? { ...s, level } : s))
    );
  };

  const handleAddGear = () => {
    const trimmed = gearInput.trim();
    if (!trimmed || gearList.includes(trimmed)) return;
    setGearList((prev) => [...prev, trimmed]);
    setGearInput('');
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    setSaving(true);
    setSavedToast(false);

    const { profile: updated, error } = await profileService.update(user.id, {
      avatar_url: avatarUrl,
      display_name: displayName.trim(),
      full_name: fullName.trim(),
      phone: phone.trim(),
      bio: bio.trim(),
      home_area: homeArea.trim(),
      handedness,
      preferred_format: preferredFormat,
      open_to_match: openToMatch,
      sports,
      gear: gearList,
    });

    setSaving(false);

    if (error) {
      alert(`Could not save profile: ${error}`);
      return;
    }

    if (updated && onProfileUpdated) {
      onProfileUpdated(updated);
    }

    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3000);
  };

  return (
    <section className="mx-auto min-h-[85vh] max-w-6xl px-5 py-6 lg:px-8 lg:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-black/10 dark:border-white/10 pb-4">
        <p className="text-xs font-black uppercase tracking-[.2em] text-[#81971d] dark:text-[#d8ff3e]">
          Player Profile
        </p>
        <p className="text-xs font-semibold text-black/50 dark:text-[#F7F8F4]/60">
          {user?.email}
        </p>
      </div>

      <form onSubmit={handleSaveProfile} className="mt-5 space-y-5">
        {/* CARD 1: AVATAR UPLOAD / CAMERA / DRAG-AND-DROP & IDENTITY */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`rounded-3xl border transition bg-white dark:bg-[#16171A] p-6 sm:p-8 shadow-sm ${
            isDragging
              ? 'border-2 border-dashed border-[#81971d] dark:border-[#d8ff3e] bg-[#f7f8f4] dark:bg-[#1E2025]'
              : 'border-black/10 dark:border-white/10'
          }`}
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center border-b border-black/10 dark:border-white/10 pb-6">
            <div
              onClick={() => galleryInputRef.current?.click()}
              title="Click or drop an image to change profile picture"
              className="group relative h-24 w-24 shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-black/15 dark:border-white/15 bg-[#9E9E9E]"
            >
              {uploadingPhoto ? (
                <div className="flex h-full w-full items-center justify-center bg-black/60 text-white">
                  <Loader2 size={22} className="animate-spin" />
                </div>
              ) : avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile avatar"
                  className="h-full w-full object-cover"
                />
              ) : (
                <DefaultAvatar />
              )}

              <div className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition group-hover:opacity-100">
                <ImagePlus size={20} className="text-white" />
              </div>
            </div>

            <div className="flex-1">
              <h1 className="text-xl font-black tracking-tight text-[#101310] dark:text-[#F7F8F4]">
                Customize Your Profile
              </h1>
              <p className="mt-0.5 text-xs text-black/50 dark:text-[#F7F8F4]/60">
                Take a photo with your camera, pick from your gallery, or drag &amp; drop an image anywhere here.
              </p>

              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="mt-3.5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={openCamera}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#101310] dark:bg-[#d8ff3e] px-3.5 py-2 text-xs font-black text-[#d8ff3e] dark:text-[#101310] transition hover:opacity-90"
                >
                  <Camera size={14} /> Take Photo
                </button>

                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-black/15 dark:border-white/15 bg-[#f7f8f4] dark:bg-[#0B0B0C] px-3.5 py-2 text-xs font-extrabold text-[#101310] dark:text-[#F7F8F4] transition hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <ImagePlus size={14} /> Choose from Gallery
                </button>

                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl('')}
                    className="inline-flex items-center gap-1 rounded-xl px-2.5 py-2 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                  >
                    <Trash2 size={13} /> Reset to Default
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-extrabold text-[#101310] dark:text-[#F7F8F4]">
                Display Name (shown on court matrix)
              </label>
              <input
                type="text"
                required
                maxLength={24}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. ming"
                className="mt-1.5 w-full rounded-xl border border-black/15 dark:border-white/10 bg-[#f7f8f4] dark:bg-[#0B0B0C] px-3.5 py-2 text-xs font-bold text-[#101310] dark:text-[#F7F8F4] outline-none focus:border-[#81971d] dark:focus:border-[#d8ff3e]"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-[#101310] dark:text-[#F7F8F4]">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                className="mt-1.5 w-full rounded-xl border border-black/15 dark:border-white/10 bg-[#f7f8f4] dark:bg-[#0B0B0C] px-3.5 py-2 text-xs font-bold text-[#101310] dark:text-[#F7F8F4] outline-none focus:border-[#81971d] dark:focus:border-[#d8ff3e]"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-[#101310] dark:text-[#F7F8F4]">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 081-234-5678"
                className="mt-1.5 w-full rounded-xl border border-black/15 dark:border-white/10 bg-[#f7f8f4] dark:bg-[#0B0B0C] px-3.5 py-2 text-xs font-bold text-[#101310] dark:text-[#F7F8F4] outline-none focus:border-[#81971d] dark:focus:border-[#d8ff3e]"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-extrabold text-[#101310] dark:text-[#F7F8F4]">
                Bio / Player Intro
              </label>
              <textarea
                rows={2}
                maxLength={220}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Always down for fast-paced badminton doubles after 6 PM or weekend padel..."
                className="mt-1.5 w-full rounded-xl border border-black/15 dark:border-white/10 bg-[#f7f8f4] dark:bg-[#0B0B0C] px-3.5 py-2 text-xs font-medium text-[#101310] dark:text-[#F7F8F4] outline-none focus:border-[#81971d] dark:focus:border-[#d8ff3e]"
              />
            </div>
          </div>
        </div>

        {/* CARD 2: SPORTS I PLAY & PLAYSTYLE */}
        <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#16171A] p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-2">
            <Trophy size={16} className="text-[#81971d] dark:text-[#d8ff3e]" />
            <h2 className="text-lg font-black text-[#101310] dark:text-[#F7F8F4]">
              Sports I Play &amp; Skill Level
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-black/50 dark:text-[#F7F8F4]/60">
            Select your sports and set your current level for each.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {SPORT_OPTIONS.map((sport) => {
              const active = sports.some((s) => s.sport === sport);
              return (
                <button
                  key={sport}
                  type="button"
                  onClick={() => toggleSport(sport)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-black transition ${
                    active
                      ? 'border-[#101310] dark:border-[#d8ff3e] bg-[#101310] dark:bg-[#d8ff3e] text-[#d8ff3e] dark:text-[#101310]'
                      : 'border-black/15 dark:border-white/10 bg-[#f7f8f4] dark:bg-[#0B0B0C] text-black/70 dark:text-[#F7F8F4]/75 hover:border-black/30'
                  }`}
                >
                  {active ? `✓ ${sport}` : `+ ${sport}`}
                </button>
              );
            })}
          </div>

          {sports.length > 0 && (
            <div className="mt-4 space-y-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-[#f7f8f4] dark:bg-[#0B0B0C] p-4">
              {sports.map((entry) => (
                <div
                  key={entry.sport}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="text-xs font-black text-[#101310] dark:text-[#F7F8F4]">
                    {entry.sport}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {SKILL_LEVELS.map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => updateSportLevel(entry.sport, lvl)}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                          entry.level === lvl
                            ? 'bg-[#81971d] dark:bg-[#d8ff3e] text-white dark:text-[#101310]'
                            : 'bg-white dark:bg-[#16171A] text-black/60 dark:text-[#F7F8F4]/60 border border-black/10 dark:border-white/10'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-extrabold text-[#101310] dark:text-[#F7F8F4]">
                Dominant Hand
              </label>
              <select
                value={handedness}
                onChange={(e) => setHandedness(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-black/15 dark:border-white/10 bg-[#f7f8f4] dark:bg-[#0B0B0C] px-3 py-2 text-xs font-bold text-[#101310] dark:text-[#F7F8F4] outline-none"
              >
                {HANDEDNESS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-[#101310] dark:text-[#F7F8F4]">
                Preferred Format
              </label>
              <select
                value={preferredFormat}
                onChange={(e) => setPreferredFormat(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-black/15 dark:border-white/10 bg-[#f7f8f4] dark:bg-[#0B0B0C] px-3 py-2 text-xs font-bold text-[#101310] dark:text-[#F7F8F4] outline-none"
              >
                {FORMAT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-[#101310] dark:text-[#F7F8F4]">
                Home Area / Neighborhood
              </label>
              <input
                type="text"
                value={homeArea}
                onChange={(e) => setHomeArea(e.target.value)}
                placeholder="e.g. Thonglor / Rama IX"
                className="mt-1.5 w-full rounded-xl border border-black/15 dark:border-white/10 bg-[#f7f8f4] dark:bg-[#0B0B0C] px-3 py-2 text-xs font-bold text-[#101310] dark:text-[#F7F8F4] outline-none"
              />
            </div>
          </div>

          <label className="mt-4 flex cursor-pointer items-center justify-between rounded-2xl border border-black/10 dark:border-white/10 bg-[#f7f8f4] dark:bg-[#0B0B0C] px-4 py-3">
            <div>
              <p className="text-xs font-black text-[#101310] dark:text-[#F7F8F4]">
                Open to Hitting Partners &amp; Open Games
              </p>
              <p className="text-[11px] text-black/55 dark:text-[#F7F8F4]/60">
                Let other players know you are up for casual rallies or fill-in spots.
              </p>
            </div>
            <input
              type="checkbox"
              checked={openToMatch}
              onChange={(e) => setOpenToMatch(e.target.checked)}
              className="h-4 w-4 accent-[#81971d]"
            />
          </label>
        </div>

        {/* CARD 3: GEAR I USE */}
        <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#16171A] p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-[#81971d] dark:text-[#d8ff3e]" />
            <h2 className="text-lg font-black text-[#101310] dark:text-[#F7F8F4]">
              Gear I Use
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-black/50 dark:text-[#F7F8F4]/60">
            Add your rackets, paddles, shoes, or string tension setups.
          </p>

          <div className="mt-4 flex gap-2">
            <input
              type="text"
              value={gearInput}
              onChange={(e) => setGearInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddGear();
                }
              }}
              placeholder="e.g. Yonex Astrox 88D Pro · BG80 @ 27 lbs"
              className="flex-1 rounded-xl border border-black/15 dark:border-white/10 bg-[#f7f8f4] dark:bg-[#0B0B0C] px-3.5 py-2 text-xs font-semibold text-[#101310] dark:text-[#F7F8F4] outline-none focus:border-[#81971d] dark:focus:border-[#d8ff3e]"
            />
            <button
              type="button"
              onClick={handleAddGear}
              className="inline-flex items-center gap-1 rounded-xl bg-[#101310] dark:bg-[#d8ff3e] px-4 py-2 text-xs font-black text-[#d8ff3e] dark:text-[#101310] transition hover:opacity-90"
            >
              <Plus size={14} /> Add
            </button>
          </div>

          {gearList.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {gearList.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1.5 rounded-full border border-black/15 dark:border-white/10 bg-[#f7f8f4] dark:bg-[#0B0B0C] px-3 py-1 text-xs font-bold text-[#101310] dark:text-[#F7F8F4]"
                >
                  {item}
                  <button
                    type="button"
                    onClick={() =>
                      setGearList((prev) => prev.filter((g) => g !== item))
                    }
                    className="text-black/45 hover:text-red-500"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* SAVE FOOTER */}
        <div className="flex items-center justify-end gap-3 pt-1">
          {savedToast && (
            <span className="inline-flex items-center gap-1.5 text-xs font-black text-green-600 dark:text-[#d8ff3e]">
              <ShieldCheck size={15} /> Profile saved!
            </span>
          )}

          <button
            type="submit"
            disabled={saving || uploadingPhoto}
            className="inline-flex items-center gap-2 rounded-xl bg-[#d8ff3e] px-5 py-2.5 text-xs font-black text-[#101310] border border-black/15 shadow-sm transition hover:bg-[#cbf528] disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Check size={14} /> Save Profile
              </>
            )}
          </button>
        </div>
      </form>

      {/* LIVE CAMERA CAPTURE MODAL */}
      {cameraOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={closeCamera}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-white/10 bg-white dark:bg-[#16171A] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3">
              <p className="text-sm font-black text-[#101310] dark:text-[#F7F8F4]">
                Take Profile Photo
              </p>
              <button
                type="button"
                onClick={closeCamera}
                className="rounded-full p-1 text-black/50 hover:text-black dark:text-white/60 dark:hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full -scale-x-100 object-cover"
              />
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={closeCamera}
                className="flex-1 rounded-xl border border-black/15 dark:border-white/15 py-2.5 text-xs font-bold text-[#101310] dark:text-[#F7F8F4]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={captureFromCamera}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#d8ff3e] py-2.5 text-xs font-black text-[#101310]"
              >
                <Camera size={14} /> Capture
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}