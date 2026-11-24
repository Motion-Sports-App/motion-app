'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Camera,
  Check,
  Loader2,
  Plus,
  X,
  Trophy,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

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

const AVATAR_PRESETS = [
  { id: 'lime', bg: 'bg-[#101310] text-[#d8ff3e]', label: 'Motion Dark' },
  { id: 'volt', bg: 'bg-[#d8ff3e] text-[#101310]', label: 'Volt Lime' },
  { id: 'emerald', bg: 'bg-emerald-600 text-white', label: 'Court Green' },
  { id: 'amber', bg: 'bg-amber-500 text-[#101310]', label: 'Clay Amber' },
  { id: 'indigo', bg: 'bg-indigo-600 text-white', label: 'Night Session' },
];

type SportEntry = {
  sport: string;
  level: (typeof SKILL_LEVELS)[number];
};

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  // Profile fields
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarTheme, setAvatarTheme] = useState('lime');
  const [displayName, setDisplayName] = useState('');
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [homeArea, setHomeArea] = useState('');
  const [handedness, setHandedness] = useState<string>('Right-handed');
  const [preferredFormat, setPreferredFormat] = useState<string>('Doubles');
  const [openToMatch, setOpenToMatch] = useState<boolean>(true);

  const [sports, setSports] = useState<SportEntry[]>([
    { sport: 'Badminton', level: 'Intermediate' },
  ]);
  const [gearList, setGearList] = useState<string[]>([]);
  const [gearInput, setGearInput] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (authUser) {
        setUser(authUser);
        const meta = authUser.user_metadata || {};
        setAvatarUrl(meta.avatar_url || '');
        setAvatarTheme(meta.avatar_theme || 'lime');
        setDisplayName(meta.display_name || meta.name || authUser.email?.split('@')[0] || '');
        setFullName(meta.full_name || meta.name || '');
        setBio(meta.bio || '');
        setHomeArea(meta.home_area || '');
        setHandedness(meta.handedness || 'Right-handed');
        setPreferredFormat(meta.preferred_format || 'Doubles');
        setOpenToMatch(meta.open_to_match ?? true);
        if (Array.isArray(meta.sports) && meta.sports.length > 0) {
          setSports(meta.sports);
        }
        if (Array.isArray(meta.gear)) {
          setGearList(meta.gear);
        }
      }
      setLoading(false);
    };

    loadProfile();
  }, []);

  const toggleSport = (sportName: string) => {
    setSports((prev) => {
      const exists = prev.some((s) => s.sport === sportName);
      if (exists) {
        return prev.filter((s) => s.sport !== sportName);
      }
      return [...prev, { sport: sportName, level: 'Intermediate' }];
    });
  };

  const updateSportLevel = (sportName: string, level: (typeof SKILL_LEVELS)[number]) => {
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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Preview immediately via Data URL (or swap with Supabase Storage bucket upload if configured)
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatarUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setSavedToast(false);

    try {
      const payload = {
        avatar_url: avatarUrl,
        avatar_theme: avatarTheme,
        display_name: displayName.trim(),
        full_name: fullName.trim(),
        bio: bio.trim(),
        home_area: homeArea.trim(),
        handedness,
        preferred_format: preferredFormat,
        open_to_match: openToMatch,
        sports,
        gear: gearList,
      };

      const { error } = await supabase.auth.updateUser({
        data: payload,
      });

      if (error) throw error;

      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 3000);
    } catch (err: any) {
      alert(`Could not save profile: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const selectedThemeObj =
    AVATAR_PRESETS.find((p) => p.id === avatarTheme) || AVATAR_PRESETS[0];
  const initialChar = (displayName || fullName || user?.email || 'M')
    .charAt(0)
    .toUpperCase();

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-[#81971d] dark:text-[#d8ff3e]" />
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-5 py-8 lg:px-8">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-5">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl border border-black/15 dark:border-white/10 bg-white dark:bg-[#16171A] px-3.5 py-2 text-xs font-extrabold text-[#101310] dark:text-[#F7F8F4] transition hover:bg-black/5 dark:hover:bg-white/10"
        >
          <ArrowLeft size={14} /> Back to Courts
        </Link>

        <span className="text-xs font-black uppercase tracking-[0.2em] text-[#81971d] dark:text-[#d8ff3e]">
          Player Profile
        </span>
      </div>

      <form onSubmit={handleSaveProfile} className="mt-6 space-y-6">
        {/* CARD 1: AVATAR & IDENTITY */}
        <section className="rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#16171A] p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            {/* Avatar Circle */}
            <div className="relative shrink-0">
              <div
                className={`flex h-24 w-24 items-center justify-center rounded-full border-2 border-[#101310] dark:border-white/20 text-3xl font-black overflow-hidden ${selectedThemeObj.bg}`}
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Profile avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initialChar
                )}
              </div>

              <label
                title="Upload profile picture"
                className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[#d8ff3e] text-[#101310] border border-black/20 shadow transition hover:scale-105"
              >
                <Camera size={14} />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Avatar Color Presets + Remove Photo */}
            <div className="flex-1">
              <h1 className="text-2xl font-black tracking-tight text-[#101310] dark:text-[#F7F8F4]">
                Customize Your Profile
              </h1>
              <p className="mt-1 text-xs text-black/55 dark:text-[#F7F8F4]/60">
                Choose a custom photo or pick an avatar badge color shown on court bookings.
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {AVATAR_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setAvatarUrl('');
                      setAvatarTheme(preset.id);
                    }}
                    className={`h-7 w-7 rounded-full border-2 transition ${preset.bg} ${
                      !avatarUrl && avatarTheme === preset.id
                        ? 'scale-110 border-[#81971d] dark:border-[#d8ff3e] ring-2 ring-black/20'
                        : 'border-black/15 opacity-80 hover:opacity-100'
                    }`}
                    title={preset.label}
                  />
                ))}

                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl('')}
                    className="ml-2 text-xs font-bold text-red-600 dark:text-red-400 underline"
                  >
                    Remove photo
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Display Name, Full Name, Home Area, Bio */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                className="mt-1.5 w-full rounded-xl border border-black/15 dark:border-white/10 bg-[#f7f8f4] dark:bg-[#0B0B0C] px-3.5 py-2.5 text-sm font-semibold text-[#101310] dark:text-[#F7F8F4] outline-none focus:border-[#81971d] dark:focus:border-[#d8ff3e]"
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
                className="mt-1.5 w-full rounded-xl border border-black/15 dark:border-white/10 bg-[#f7f8f4] dark:bg-[#0B0B0C] px-3.5 py-2.5 text-sm font-semibold text-[#101310] dark:text-[#F7F8F4] outline-none focus:border-[#81971d] dark:focus:border-[#d8ff3e]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-extrabold text-[#101310] dark:text-[#F7F8F4]">
                Bio / Player Intro
              </label>
              <textarea
                rows={3}
                maxLength={220}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Always down for fast-paced badminton doubles after 6 PM or weekend padel..."
                className="mt-1.5 w-full rounded-xl border border-black/15 dark:border-white/10 bg-[#f7f8f4] dark:bg-[#0B0B0C] px-3.5 py-2.5 text-sm font-medium text-[#101310] dark:text-[#F7F8F4] outline-none focus:border-[#81971d] dark:focus:border-[#d8ff3e]"
              />
            </div>
          </div>
        </section>

        {/* CARD 2: SPORTS I PLAY & PLAYSTYLE */}
        <section className="rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#16171A] p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-2">
            <Trophy size={18} className="text-[#81971d] dark:text-[#d8ff3e]" />
            <h2 className="text-lg font-black text-[#101310] dark:text-[#F7F8F4]">
              Sports I Play & Skill Level
            </h2>
          </div>
          <p className="mt-1 text-xs text-black/55 dark:text-[#F7F8F4]/60">
            Select your sports and set your current level for each.
          </p>

          {/* Sport Toggle Pills */}
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

          {/* Skill Level Selector per Chosen Sport */}
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

          {/* Playstyle Preferences */}
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-extrabold text-[#101310] dark:text-[#F7F8F4]">
                Dominant Hand
              </label>
              <select
                value={handedness}
                onChange={(e) => setHandedness(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-black/15 dark:border-white/10 bg-[#f7f8f4] dark:bg-[#0B0B0C] px-3 py-2.5 text-xs font-bold text-[#101310] dark:text-[#F7F8F4] outline-none"
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
                className="mt-1.5 w-full rounded-xl border border-black/15 dark:border-white/10 bg-[#f7f8f4] dark:bg-[#0B0B0C] px-3 py-2.5 text-xs font-bold text-[#101310] dark:text-[#F7F8F4] outline-none"
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
                className="mt-1.5 w-full rounded-xl border border-black/15 dark:border-white/10 bg-[#f7f8f4] dark:bg-[#0B0B0C] px-3 py-2.5 text-xs font-bold text-[#101310] dark:text-[#F7F8F4] outline-none"
              />
            </div>
          </div>

          {/* Open to Hitting Partners Toggle */}
          <label className="mt-4 flex cursor-pointer items-center justify-between rounded-2xl border border-black/10 dark:border-white/10 bg-[#f7f8f4] dark:bg-[#0B0B0C] px-4 py-3">
            <div>
              <p className="text-xs font-black text-[#101310] dark:text-[#F7F8F4]">
                Open to Hitting Partners & Open Games
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
        </section>

        {/* CARD 3: MY GEAR BAG */}
        <section className="rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#16171A] p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-[#81971d] dark:text-[#d8ff3e]" />
            <h2 className="text-lg font-black text-[#101310] dark:text-[#F7F8F4]">
              Gear I Use
            </h2>
          </div>
          <p className="mt-1 text-xs text-black/55 dark:text-[#F7F8F4]/60">
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
              className="flex-1 rounded-xl border border-black/15 dark:border-white/10 bg-[#f7f8f4] dark:bg-[#0B0B0C] px-3.5 py-2.5 text-xs font-semibold text-[#101310] dark:text-[#F7F8F4] outline-none focus:border-[#81971d] dark:focus:border-[#d8ff3e]"
            />
            <button
              type="button"
              onClick={handleAddGear}
              className="inline-flex items-center gap-1 rounded-xl bg-[#101310] dark:bg-[#d8ff3e] px-4 py-2.5 text-xs font-black text-[#d8ff3e] dark:text-[#101310] transition hover:opacity-90"
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
        </section>

        {/* SAVE ACTION BAR */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {savedToast && (
            <span className="inline-flex items-center gap-1.5 text-xs font-black text-green-600 dark:text-[#d8ff3e]">
              <ShieldCheck size={15} /> Profile saved!
            </span>
          )}

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#d8ff3e] px-6 py-3 text-sm font-black text-[#101310] border border-black/15 shadow-sm transition hover:bg-[#cbf528] disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Check size={16} /> Save Profile
              </>
            )}
          </button>
        </div>
      </form>
    </main>
  );
}