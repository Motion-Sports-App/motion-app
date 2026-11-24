'use client';

import { useState, useEffect } from 'react';
import {
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

export default function ProfileView({
  user,
  onUserUpdated,
}: {
  user: any;
  onUserUpdated?: (updatedUser: any) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  const meta = user?.user_metadata || {};

  const [avatarUrl, setAvatarUrl] = useState<string>(meta.avatar_url || '');
  const [avatarTheme, setAvatarTheme] = useState<string>(meta.avatar_theme || 'lime');
  const [displayName, setDisplayName] = useState<string>(
    meta.display_name || meta.full_name || user?.email?.split('@')[0] || ''
  );
  const [fullName, setFullName] = useState<string>(meta.full_name || '');
  const [bio, setBio] = useState<string>(meta.bio || '');
  const [homeArea, setHomeArea] = useState<string>(meta.home_area || '');
  const [handedness, setHandedness] = useState<string>(meta.handedness || 'Right-handed');
  const [preferredFormat, setPreferredFormat] = useState<string>(
    meta.preferred_format || 'Doubles'
  );
  const [openToMatch, setOpenToMatch] = useState<boolean>(meta.open_to_match ?? true);

  const [sports, setSports] = useState<SportEntry[]>(
    Array.isArray(meta.sports) && meta.sports.length > 0
      ? meta.sports
      : [{ sport: 'Badminton', level: 'Intermediate' }]
  );
  const [gearList, setGearList] = useState<string[]>(
    Array.isArray(meta.gear) ? meta.gear : []
  );
  const [gearInput, setGearInput] = useState('');

  useEffect(() => {
    if (!user) return;
    const m = user.user_metadata || {};
    setAvatarUrl(m.avatar_url || '');
    setAvatarTheme(m.avatar_theme || 'lime');
    setDisplayName(m.display_name || m.full_name || user.email?.split('@')[0] || '');
    setFullName(m.full_name || '');
    setBio(m.bio || '');
    setHomeArea(m.home_area || '');
    setHandedness(m.handedness || 'Right-handed');
    setPreferredFormat(m.preferred_format || 'Doubles');
    setOpenToMatch(m.open_to_match ?? true);
    if (Array.isArray(m.sports) && m.sports.length > 0) setSports(m.sports);
    if (Array.isArray(m.gear)) setGearList(m.gear);
  }, [user]);

  const toggleSport = (sportName: string) => {
    setSports((prev) => {
      const exists = prev.some((s) => s.sport === sportName);
      if (exists) return prev.filter((s) => s.sport !== sportName);
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

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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

      const { data, error } = await supabase.auth.updateUser({
        data: payload,
      });

      if (error) throw error;

      if (data?.user && onUserUpdated) {
        onUserUpdated(data.user);
      }

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
        {/* CARD 1: AVATAR & IDENTITY */}
        <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#16171A] p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center border-b border-black/10 dark:border-white/10 pb-6">
            <div className="relative shrink-0">
              <div
                className={`flex h-20 w-20 items-center justify-center rounded-full border-2 border-[#101310] dark:border-white/20 text-2xl font-black overflow-hidden ${selectedThemeObj.bg}`}
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
                className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-[#d8ff3e] text-[#101310] border border-black/20 shadow transition hover:scale-105"
              >
                <Camera size={13} />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div className="flex-1">
              <h1 className="text-xl font-black tracking-tight text-[#101310] dark:text-[#F7F8F4]">
                Customize Your Profile
              </h1>
              <p className="mt-0.5 text-xs text-black/50 dark:text-[#F7F8F4]/60">
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
                    className={`h-6 w-6 rounded-full border-2 transition ${preset.bg} ${
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

            <div className="sm:col-span-2">
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
              Sports I Play & Skill Level
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
            disabled={saving}
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
    </section>
  );
}