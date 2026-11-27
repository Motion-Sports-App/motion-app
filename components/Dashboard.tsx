'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Building2,
  Calendar,
  Clock,
  DollarSign,
  UserCheck,
  XCircle,
  CheckCircle2,
  Sliders,
  Edit2,
  Check,
  Loader2,
  BarChart3,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  PlusCircle,
  X,
  ArrowRightLeft,
  GripVertical,
  Search,
  LayoutGrid,
  List,
  Trophy,
  Plus,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { partnerService, type SportConfig } from '@/lib/services/partnerService';
import { bookingService, type Booking } from '@/lib/services/bookingService';
import type { Venue, OperatingHours } from '@/lib/data';
import { money } from '@/lib/constants';

type DashboardBooking = Booking & {
  customerName?: string;
  customerEmail?: string;
  courtCount?: number;
  userId?: string | null;
};

type SelectedBookedCell = {
  key: string;
  court: number;
  time: string;
  booking: DashboardBooking;
};

type ClusterCellVisual = {
  topEdge: boolean;
  bottomEdge: boolean;
  leftEdge: boolean;
  rightEdge: boolean;
  showLabel: boolean;
  label: string;
  offsetXPercent: number;
  offsetYPercent: number;
};

const DEFAULT_HOURS = [
  '00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00',
  '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00',
  '14:00', '15:00', '16:00', '17:00', '18:00', '19:00',
  '20:00', '21:00', '22:00', '23:00',
];

const ADDABLE_SPORTS = [
  'Badminton',
  'Tennis',
  'Padel',
  'Pickleball',
  'Basketball',
  'Futsal',
  'Squash',
  'Table Tennis',
];

const getLocalTodayStr = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// Format "08:00" -> "08:00 - 09:00" to stay compatible with ALL_BOOKING_SLOTS in bookingService
const toFullSlotLabel = (startHourStr: string) => {
  const hr = parseInt(startHourStr.split(':')[0], 10);
  const nextHr = (hr + 1) % 24;
  return `${String(hr).padStart(2, '0')}:00 - ${String(nextHr).padStart(2, '0')}:00`;
};

// Normalize sport label for consistent display & comparison (e.g. "badminton" -> "Badminton")
const formatSportLabel = (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return trimmed
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

// Extract all sports associated with a venue (supports comma-separated strings, sports[], or sport_configs)
const extractVenueSports = (venue: Venue | null): string[] => {
  if (!venue) return [];
  const rawList: string[] = [];

  if (Array.isArray((venue as any).sports)) {
    (venue as any).sports.forEach((s: unknown) => {
      if (typeof s === 'string') rawList.push(s);
    });
  }

  const sportConfigs = (venue as any).sport_configs;
  if (sportConfigs && typeof sportConfigs === 'object') {
    Object.keys(sportConfigs).forEach((k) => rawList.push(k));
  }

  if (typeof venue.sport === 'string' && venue.sport.trim()) {
    venue.sport.split(/[,/|]+/).forEach((s) => rawList.push(s));
  }

  const uniqueMap = new Map<string, string>();
  rawList.forEach((item) => {
    const formatted = formatSportLabel(item);
    if (formatted) {
      uniqueMap.set(formatted.toUpperCase(), formatted);
    }
  });

  return Array.from(uniqueMap.values());
};

// Clean display label for the matrix block ("ming", "amy", "tonnam", or "Walk-in")
const getMatrixBookerLabel = (booking: DashboardBooking): string => {
  const rawName = String(booking.customerName || '').trim();
  if (rawName) {
    const cleaned = rawName.replace(/\s*\(front\s*desk\)\s*$/i, '').trim();
    if (!cleaned || /^walk[-\s]?in(\s+player)?$/i.test(cleaned)) {
      return 'Walk-in';
    }
    return cleaned;
  }

  const rawEmail = String(booking.customerEmail || '').trim();
  if (rawEmail && !rawEmail.toLowerCase().startsWith('frontdesk@')) {
    return rawEmail.split('@')[0];
  }

  return 'Walk-in';
};

// Stable identity key for grouping adjacent bookings by the same person
const getBookerIdentityKey = (booking: DashboardBooking): string => {
  const label = getMatrixBookerLabel(booking).toLowerCase();
  if (label === 'walk-in') {
    return `walkin:${booking.dbId || booking.id}`;
  }
  if (booking.userId) {
    return `user:${booking.userId}`;
  }
  return `name:${label}`;
};

// Determine if a booking is in the past based on current date and slot end time
const isBookingInPast = (booking: DashboardBooking, now: Date) => {
  if (!booking.date) return false;
  const parts = booking.date.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return false;

  const [year, month, day] = parts;
  const rawTime = String(booking.time || '');

  const rangeMatch = rawTime.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
  const singleMatch = rawTime.match(/(\d{1,2}):(\d{2})/);

  let endHour = 23;
  let endMinute = 59;
  let isNextDayMidnight = false;

  if (rangeMatch) {
    const startH = parseInt(rangeMatch[1], 10);
    endHour = parseInt(rangeMatch[3], 10);
    endMinute = parseInt(rangeMatch[4], 10);
    if (endHour === 0 && endMinute === 0 && startH > 0) {
      isNextDayMidnight = true;
    }
  } else if (singleMatch) {
    endHour = parseInt(singleMatch[1], 10) + 1;
    endMinute = parseInt(singleMatch[2], 10);
    if (endHour >= 24) {
      endHour = 0;
      isNextDayMidnight = true;
    }
  }

  const endDateTime = new Date(
    year,
    month - 1,
    day + (isNextDayMidnight ? 1 : 0),
    endHour,
    endMinute,
    0
  );

  return endDateTime.getTime() < now.getTime();
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function Dashboard({
  user,
  bookings,
  venues,
  hasActiveCoach = false,
  onBack,
  onCancel,
  onVenueUpdate,
}: {
  user: any;
  bookings: Booking[];
  venues: Venue[];
  hasActiveCoach?: boolean;
  onBack?: () => void;
  onCancel: (id: string) => void;
  onVenueUpdate?: (updatedVenue: Venue) => void;
}) {
  const [activeRole, setActiveRole] = useState<'venue' | 'coach'>('venue');
  const [selectedDate, setSelectedDate] = useState<string>(() => getLocalTodayStr());
  const [selectedVenueId, setSelectedVenueId] = useState<string>('');
  const [selectedMatrixSport, setSelectedMatrixSport] = useState<string>('');

  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showVenueStats, setShowVenueStats] = useState(false);

  // Add-Sport inline modal state for multi-sport venues
  const [showAddSportModal, setShowAddSportModal] = useState(false);
  const [newSportName, setNewSportName] = useState('Padel');
  const [newSportCourts, setNewSportCourts] = useState(2);
  const [newSportRate, setNewSportRate] = useState(350);
  const [isAddingSport, setIsAddingSport] = useState(false);

  // Front-Desk "Book Court" Mode States (for selecting open white slots)
  const [isBookingMode, setIsBookingMode] = useState(false);

  // Drag & Drop Swap Courts Mode States
  const [isSwapMode, setIsSwapMode] = useState(false);
  const [draggedCell, setDraggedCell] = useState<SelectedBookedCell | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [isSwapping, setIsSwapping] = useState(false);

  const [selectedSlots, setSelectedSlots] = useState<
    { court: number; time: string }[]
  >([]);
  const [walkInName, setWalkInName] = useState('');
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);

  // Multi-select state for red/booked slots (for bulk cancel or moving courts)
  const [selectedBookedCells, setSelectedBookedCells] = useState<
    SelectedBookedCell[]
  >([]);
  const [targetMoveCourt, setTargetMoveCourt] = useState<number>(1);
  const [isProcessingBookedAction, setIsProcessingBookedAction] = useState(false);

  // Master Reservation List Controls
  const [masterTimeTab, setMasterTimeTab] = useState<'active' | 'past'>('active');
  const [masterSearchQuery, setMasterSearchQuery] = useState<string>('');
  const [masterSportFilter, setMasterSportFilter] = useState<string>('ALL');
  const [masterVisibleCount, setMasterVisibleCount] = useState<number>(10);
  const [masterViewMode, setMasterViewMode] = useState<'list' | 'grid'>('list');
  const [currentTime, setCurrentTime] = useState<Date>(() => new Date());

  // Live venue bookings mapped from Supabase `bookings` columns
  const [venueBookings, setVenueBookings] = useState<DashboardBooking[]>(
    bookings || []
  );

  const isSuperAdmin = useMemo(() => {
    return Boolean(
      user?.email &&
        [
          'mingtan0403@gmail.com',
          'motionsportsapp@gmail.com',
          'kvorakijkamjorn@gmail.com',
          'darylhsu45@gmail.com',
        ].includes(user.email.toLowerCase())
    );
  }, [user]);

  const ownedVenues = useMemo(() => {
    if (!venues || venues.length === 0) return [];
    if (isSuperAdmin) return venues;
    if (!user?.id) return [];
    return venues.filter((v) => v.user_id === user.id || v.owner_id === user.id);
  }, [venues, user, isSuperAdmin]);

  const selectedVenue = useMemo(() => {
    if (ownedVenues.length === 0) return null;
    return ownedVenues.find((v) => v.id === selectedVenueId) || ownedVenues[0];
  }, [ownedVenues, selectedVenueId]);

  const [isApprovedCoach, setIsApprovedCoach] = useState<boolean>(hasActiveCoach);

  useEffect(() => {
    setIsApprovedCoach(hasActiveCoach);
  }, [hasActiveCoach]);

  useEffect(() => {
    if (!user?.id) {
      setIsApprovedCoach(false);
      return;
    }
    partnerService.getUserApplicationStatuses(user.id).then(({ coachStatus }) => {
      setIsApprovedCoach(coachStatus === 'approved');
    });
  }, [user?.id]);

  const hasVenueAccess = isSuperAdmin || ownedVenues.length > 0;
  const hasCoachAccess = isSuperAdmin || isApprovedCoach;
  const hasBothRoles = hasVenueAccess && hasCoachAccess;

  useEffect(() => {
    if (hasVenueAccess && !hasCoachAccess) {
      setActiveRole('venue');
    } else if (!hasVenueAccess && hasCoachAccess) {
      setActiveRole('coach');
    }
  }, [hasVenueAccess, hasCoachAccess]);

  const fetchVenueBookings = useCallback(async () => {
    if (!selectedVenue?.id && !selectedVenue?.name) return;

    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      const venueRows = data.filter((b: any) => {
        if (b.venue_id && selectedVenue.id) {
          return String(b.venue_id) === String(selectedVenue.id);
        }
        return (
          String(b.venue_name || '').trim().toLowerCase() ===
          String(selectedVenue.name || '').trim().toLowerCase()
        );
      });

      const primaryVenueSport =
        extractVenueSports(selectedVenue)[0] || 'Badminton';

      const mapped: DashboardBooking[] = venueRows.map((b: any) => ({
        id: b.booking_code || String(b.id),
        dbId: String(b.id),
        venue: b.venue_name || selectedVenue.name || 'Court Booking',
        sport: formatSportLabel(String(b.sport || primaryVenueSport)),
        date: b.booking_date || b.date,
        time: b.time_slot || b.booking_time || '',
        price: Number(b.total_amount ?? b.price ?? 0),
        status:
          String(b.status || '').toLowerCase() === 'cancelled'
            ? 'Cancelled'
            : 'Confirmed',
        pointsEarned: b.points_earned || 0,
        customerName: b.customer_name || '',
        customerEmail: b.customer_email || '',
        courtCount: Number(b.court_count || 1),
        userId: b.user_id || null,
      }));
      setVenueBookings(mapped);
    } else if (error) {
      console.error('Error fetching venue bookings:', error);
    }
  }, [selectedVenue]);

  useEffect(() => {
    fetchVenueBookings();
  }, [fetchVenueBookings]);

  // All sports available at this venue (from venue metadata + sport_configs + any existing bookings)
  const venueSportOptions = useMemo(() => {
    const map = new Map<string, string>();

    extractVenueSports(selectedVenue).forEach((s) => {
      map.set(s.toUpperCase(), s);
    });

    venueBookings.forEach((b) => {
      const formatted = formatSportLabel(String(b.sport || ''));
      if (formatted) {
        map.set(formatted.toUpperCase(), formatted);
      }
    });

    if (map.size === 0) {
      map.set('BADMINTON', 'Badminton');
    }

    return Array.from(map.values());
  }, [selectedVenue, venueBookings]);

  // Default / sync selectedMatrixSport whenever the venue or its sport options change
  useEffect(() => {
    if (venueSportOptions.length === 0) return;
    const isStillValid = venueSportOptions.some(
      (s) => s.toUpperCase() === selectedMatrixSport.toUpperCase()
    );
    if (!selectedMatrixSport || !isStillValid) {
      setSelectedMatrixSport(venueSportOptions[0]);
    }
  }, [venueSportOptions, selectedMatrixSport]);

  // Resolve the active sport's config (courts, price_per_hour, operating_hours)
  const activeSportConfig = useMemo<SportConfig | null>(() => {
    if (!selectedVenue) return null;
    const sportConfigs = (selectedVenue as any).sport_configs || {};
    if (!sportConfigs || typeof sportConfigs !== 'object') return null;

    const targetKey = selectedMatrixSport.trim().toLowerCase();
    const matchedKey = Object.keys(sportConfigs).find(
      (k) => k.trim().toLowerCase() === targetKey
    );
    return matchedKey ? (sportConfigs[matchedKey] as SportConfig) : null;
  }, [selectedVenue, selectedMatrixSport]);

  const [totalCourts, setTotalCourts] = useState<number>(1);
  const [openTime, setOpenTime] = useState<string>('08:00');
  const [closeTime, setCloseTime] = useState<string>('22:00');
  const [sportHourlyRate, setSportHourlyRate] = useState<number>(0);

  useEffect(() => {
    let currentDay = getLocalTodayStr();
    const interval = setInterval(() => {
      setCurrentTime(new Date());
      const latestDay = getLocalTodayStr();
      if (latestDay !== currentDay) {
        setSelectedDate((prev) => (prev === currentDay ? latestDay : prev));
        currentDay = latestDay;
      }
    }, 60_000);

    return () => clearInterval(interval);
  }, []);

  // Load court count, operating hours, and rate for the currently selected sport tab
  useEffect(() => {
    if (!selectedVenue) return;

    const courtCount =
      activeSportConfig?.total_courts ?? selectedVenue.total_courts ?? 1;
    setTotalCourts(Number(courtCount) > 0 ? Number(courtCount) : 1);

    const rate =
      activeSportConfig?.price_per_hour ??
      selectedVenue.price_per_hour ??
      selectedVenue.price ??
      0;
    setSportHourlyRate(Number(rate) >= 0 ? Number(rate) : 0);

    let parsedHours: OperatingHours | null =
      activeSportConfig?.operating_hours || null;

    if (!parsedHours) {
      const rawHours = selectedVenue.operating_hours;
      if (typeof rawHours === 'string') {
        try {
          parsedHours = JSON.parse(rawHours);
        } catch {
          parsedHours = null;
        }
      } else if (rawHours && typeof rawHours === 'object') {
        parsedHours = rawHours as OperatingHours;
      }
    }

    setOpenTime(parsedHours?.open_time || '08:00');
    setCloseTime(parsedHours?.close_time || '22:00');
  }, [selectedVenue, activeSportConfig]);

  const handleOpenTimeChange = (newOpen: string) => {
    setOpenTime(newOpen);
    const newOpenHr = parseInt(newOpen.split(':')[0], 10);
    const currentCloseHr = parseInt(closeTime.split(':')[0], 10);
    if (closeTime !== '00:00' && currentCloseHr <= newOpenHr) {
      const nextValidClose =
        newOpenHr + 1 >= 24 ? '00:00' : `${String(newOpenHr + 1).padStart(2, '0')}:00`;
      setCloseTime(nextValidClose);
    }
  };

  const activeHours = useMemo(() => {
    const startHour = parseInt(openTime.split(':')[0], 10);
    const rawEndHour = parseInt(closeTime.split(':')[0], 10);
    const safeStart = isNaN(startHour) ? 8 : startHour;
    const safeEnd = isNaN(rawEndHour) ? 22 : rawEndHour === 0 ? 24 : rawEndHour;

    return DEFAULT_HOURS.filter((h) => {
      const hr = parseInt(h.split(':')[0], 10);
      return hr >= safeStart && hr < safeEnd;
    });
  }, [openTime, closeTime]);

  // Map confirmed bookings on selectedDate & selectedMatrixSport onto specific (Court, Time) cells
  const bookedCellMap = useMemo(() => {
    const map: Record<string, DashboardBooking> = {};
    const targetSportUpper = selectedMatrixSport.trim().toUpperCase();

    const activeOnDate = venueBookings.filter((b) => {
      if (b.status !== 'Confirmed' || b.date !== selectedDate) return false;
      if (!targetSportUpper) return true;
      return String(b.sport || '').trim().toUpperCase() === targetSportUpper;
    });

    const fallbackUsedByTime: Record<string, number> = {};

    activeOnDate.forEach((b) => {
      const rawTime = String(b.time || '');
      const rangeMatch = rawTime.match(/(\d{2}):\d{2}\s*[-–]\s*(\d{2}):\d{2}/);
      const singleMatch = rawTime.match(/(\d{2}):\d{2}/);

      let slotTimes: string[] = [];
      if (rangeMatch) {
        const startHr = parseInt(rangeMatch[1], 10);
        const rawEndHr = parseInt(rangeMatch[2], 10);
        const endHr = rawEndHr === 0 && startHr > 0 ? 24 : rawEndHr;
        if (endHr > startHr) {
          for (let h = startHr; h < endHr; h++) {
            slotTimes.push(`${String(h).padStart(2, '0')}:00`);
          }
        } else {
          slotTimes = [`${String(startHr).padStart(2, '0')}:00`];
        }
      } else if (singleMatch) {
        slotTimes = [singleMatch[0]];
      } else {
        slotTimes = [rawTime];
      }

      const courtListMatch = rawTime.match(/Courts?\s*([\d,\s]+)/i);
      const explicitCourts = courtListMatch
        ? courtListMatch[1]
            .split(',')
            .map((n) => parseInt(n.trim(), 10))
            .filter((n) => !isNaN(n) && n >= 1 && n <= totalCourts)
        : [];

      slotTimes.forEach((slotTime) => {
        if (explicitCourts.length > 0) {
          explicitCourts.forEach((c) => {
            map[`C${c}_${slotTime}`] = b;
          });
        } else {
          const qty = Math.max(1, Number(b.courtCount || 1));
          for (let q = 0; q < qty; q++) {
            let assignedCourt = (fallbackUsedByTime[slotTime] || 0) + 1;
            while (
              map[`C${assignedCourt}_${slotTime}`] &&
              assignedCourt <= totalCourts
            ) {
              assignedCourt++;
            }
            if (assignedCourt <= totalCourts) {
              fallbackUsedByTime[slotTime] = assignedCourt;
              map[`C${assignedCourt}_${slotTime}`] = b;
            }
          }
        }
      });
    });

    return map;
  }, [venueBookings, selectedDate, selectedMatrixSport, totalCourts]);

  // Group contiguous booked cells by booker to compute outer perimeter borders & label placement
  const bookingClusterMeta = useMemo(() => {
    const meta: Record<string, ClusterCellVisual> = {};
    const visited = new Set<string>();
    const rowCount = activeHours.length;

    const getIdentityAt = (r: number, c: number): string | null => {
      if (r < 0 || r >= rowCount || c < 1 || c > totalCourts) return null;
      const b = bookedCellMap[`C${c}_${activeHours[r]}`];
      return b ? getBookerIdentityKey(b) : null;
    };

    for (let r = 0; r < rowCount; r++) {
      for (let c = 1; c <= totalCourts; c++) {
        const startKey = `C${c}_${activeHours[r]}`;
        const startBooking = bookedCellMap[startKey];
        if (!startBooking || visited.has(startKey)) continue;

        const identity = getBookerIdentityKey(startBooking);
        const component: { r: number; c: number; key: string }[] = [];
        const queue: { r: number; c: number }[] = [{ r, c }];
        visited.add(startKey);

        while (queue.length > 0) {
          const curr = queue.shift()!;
          const currKey = `C${curr.c}_${activeHours[curr.r]}`;
          component.push({ r: curr.r, c: curr.c, key: currKey });

          const neighbors = [
            { r: curr.r - 1, c: curr.c },
            { r: curr.r + 1, c: curr.c },
            { r: curr.r, c: curr.c - 1 },
            { r: curr.r, c: curr.c + 1 },
          ];

          for (const nb of neighbors) {
            if (nb.r < 0 || nb.r >= rowCount || nb.c < 1 || nb.c > totalCourts) {
              continue;
            }
            const nbKey = `C${nb.c}_${activeHours[nb.r]}`;
            if (visited.has(nbKey)) continue;
            const nbBooking = bookedCellMap[nbKey];
            if (nbBooking && getBookerIdentityKey(nbBooking) === identity) {
              visited.add(nbKey);
              queue.push(nb);
            }
          }
        }

        const memberSet = new Set(component.map((item) => `${item.r}:${item.c}`));

        const sumR = component.reduce((acc, item) => acc + item.r, 0);
        const sumC = component.reduce((acc, item) => acc + item.c, 0);
        const centerR = sumR / component.length;
        const centerC = sumC / component.length;

        const candidates: { posR: number; posC: number }[] = [];
        for (const item of component) {
          candidates.push({ posR: item.r, posC: item.c });
          const hasRight = memberSet.has(`${item.r}:${item.c + 1}`);
          const hasDown = memberSet.has(`${item.r + 1}:${item.c}`);
          const hasDiag = memberSet.has(`${item.r + 1}:${item.c + 1}`);

          if (hasRight) {
            candidates.push({ posR: item.r, posC: item.c + 0.5 });
          }
          if (hasDown) {
            candidates.push({ posR: item.r + 0.5, posC: item.c });
          }
          if (hasRight && hasDown && hasDiag) {
            candidates.push({ posR: item.r + 0.5, posC: item.c + 0.5 });
          }
        }

        const getBoundaryClearance = (posR: number, posC: number): number => {
          let minClearance = Infinity;
          const minR = Math.min(...component.map((x) => x.r)) - 1;
          const maxR = Math.max(...component.map((x) => x.r)) + 1;
          const minC = Math.min(...component.map((x) => x.c)) - 1;
          const maxC = Math.max(...component.map((x) => x.c)) + 1;

          for (let rr = minR; rr <= maxR; rr++) {
            for (let cc = minC; cc <= maxC; cc++) {
              if (memberSet.has(`${rr}:${cc}`)) continue;
              const dR = Math.max(0, Math.abs(posR - rr) - 0.5);
              const dC = Math.max(0, Math.abs(posC - cc) - 0.5);
              const weightedDist = Math.hypot(dR * 1.0, dC * 2.2);
              if (weightedDist < minClearance) {
                minClearance = weightedDist;
              }
            }
          }
          return minClearance;
        };

        let bestPos = { posR: component[0].r, posC: component[0].c };
        let bestScore = -Infinity;

        for (const cand of candidates) {
          const clearance = getBoundaryClearance(cand.posR, cand.posC);
          const distToCentroid = Math.hypot(
            cand.posR - centerR,
            cand.posC - centerC
          );
          const score = clearance * 100 - distToCentroid;
          if (score > bestScore) {
            bestScore = score;
            bestPos = cand;
          }
        }

        const anchorR = Math.floor(bestPos.posR);
        const anchorC = Math.floor(bestPos.posC);
        const anchor =
          component.find((item) => item.r === anchorR && item.c === anchorC) ||
          component[0];

        const label = getMatrixBookerLabel(startBooking);
        const offsetXPercent = (bestPos.posC - anchor.c) * 100;
        const offsetYPercent = (bestPos.posR - anchor.r) * 100;

        for (const item of component) {
          meta[item.key] = {
            topEdge: getIdentityAt(item.r - 1, item.c) !== identity,
            bottomEdge: getIdentityAt(item.r + 1, item.c) !== identity,
            leftEdge: getIdentityAt(item.r, item.c - 1) !== identity,
            rightEdge: getIdentityAt(item.r, item.c + 1) !== identity,
            showLabel: item.key === anchor.key,
            label,
            offsetXPercent: item.key === anchor.key ? offsetXPercent : 0,
            offsetYPercent: item.key === anchor.key ? offsetYPercent : 0,
          };
        }
      }
    }

    return meta;
  }, [bookedCellMap, activeHours, totalCourts]);

  // Determine which courts are conflict-free across all currently selected booked slots
  const validMoveCourts = useMemo(() => {
    if (selectedBookedCells.length === 0) return [];
    const selectedKeys = new Set(selectedBookedCells.map((c) => c.key));

    const available: number[] = [];
    for (let c = 1; c <= totalCourts; c++) {
      const hasConflict = selectedBookedCells.some((cell) => {
        const targetKey = `C${c}_${cell.time}`;
        return Boolean(bookedCellMap[targetKey]) && !selectedKeys.has(targetKey);
      });
      if (!hasConflict) {
        available.push(c);
      }
    }
    return available;
  }, [selectedBookedCells, totalCourts, bookedCellMap]);

  useEffect(() => {
    if (validMoveCourts.length > 0 && !validMoveCourts.includes(targetMoveCourt)) {
      const differentCourt = validMoveCourts.find(
        (c) => !selectedBookedCells.every((cell) => cell.court === c)
      );
      setTargetMoveCourt(differentCourt ?? validMoveCourts[0]);
    }
  }, [validMoveCourts, targetMoveCourt, selectedBookedCells]);

  const stats = useMemo(() => {
    const active = venueBookings.filter((b) => b.status === 'Confirmed');
    const cancelled = venueBookings.filter((b) => b.status === 'Cancelled');
    const totalRev = active.reduce((sum, b) => sum + Number(b.price || 0), 0);

    const totalDailySlots = totalCourts * Math.max(activeHours.length, 1);
    const bookedTodayCount = Object.keys(bookedCellMap).length;
    const occupancyRate =
      totalDailySlots > 0
        ? Math.min(100, Math.round((bookedTodayCount / totalDailySlots) * 100))
        : 0;

    return {
      revenue: totalRev,
      activeCount: active.length,
      cancelCount: cancelled.length,
      listings: ownedVenues.length,
      occupancyRate,
    };
  }, [venueBookings, ownedVenues, totalCourts, activeHours, bookedCellMap]);

  // Master Reservation List: Split into Current/Active vs Past
  const { activeTimeBookings, pastTimeBookings } = useMemo(() => {
    const activeList: DashboardBooking[] = [];
    const pastList: DashboardBooking[] = [];

    venueBookings.forEach((b) => {
      if (isBookingInPast(b, currentTime)) {
        pastList.push(b);
      } else {
        activeList.push(b);
      }
    });

    return { activeTimeBookings: activeList, pastTimeBookings: pastList };
  }, [venueBookings, currentTime]);

  const baseTabBookings =
    masterTimeTab === 'active' ? activeTimeBookings : pastTimeBookings;

  const availableMasterSports = useMemo(() => {
    const sportSet = new Set<string>();

    venueSportOptions.forEach((s) => {
      if (s.trim()) sportSet.add(s.trim().toUpperCase());
    });

    venueBookings.forEach((b) => {
      const s = String(b.sport || '').trim().toUpperCase();
      if (s) sportSet.add(s);
    });

    return Array.from(sportSet);
  }, [venueSportOptions, venueBookings]);

  const filteredMasterBookings = useMemo(() => {
    const query = masterSearchQuery.trim().toLowerCase();

    return baseTabBookings.filter((b) => {
      const bookingCode = String(b.id || '').toLowerCase();
      const matchesSearch = !query || bookingCode.includes(query);

      const sportUpper = String(b.sport || '').trim().toUpperCase();
      const matchesSport =
        masterSportFilter === 'ALL' || sportUpper === masterSportFilter;

      return matchesSearch && matchesSport;
    });
  }, [baseTabBookings, masterSearchQuery, masterSportFilter]);

  const visibleMasterBookings = useMemo(() => {
    return filteredMasterBookings.slice(0, masterVisibleCount);
  }, [filteredMasterBookings, masterVisibleCount]);

  const hasMoreMasterBookings =
    masterVisibleCount < filteredMasterBookings.length;

  const resetSwapMode = () => {
    setIsSwapMode(false);
    setDraggedCell(null);
    setDragOverKey(null);
  };

  // Persist court updates (including splitting partial multi-court bookings) in Supabase
  const applyCourtMoves = async (
    moves: {
      booking: DashboardBooking;
      fromCourt: number;
      toCourt: number;
      time: string;
    }[]
  ) => {
    if (!selectedVenue || moves.length === 0) return;

    const movesByBooking = new Map<
      string,
      { booking: DashboardBooking; items: typeof moves }
    >();
    moves.forEach((m) => {
      const bKey = m.booking.dbId || m.booking.id;
      const entry = movesByBooking.get(bKey) || {
        booking: m.booking,
        items: [],
      };
      entry.items.push(m);
      movesByBooking.set(bKey, entry);
    });

    for (const [, { booking, items }] of movesByBooking.entries()) {
      const rawTime = String(booking.time || '');
      const slotRange =
        rawTime.match(/\d{2}:\d{2}\s*[-–]\s*\d{2}:\d{2}/)?.[0] ||
        toFullSlotLabel(items[0].time);

      const courtListMatch = rawTime.match(/Courts?\s*([\d,\s]+)/i);
      const existingCourts = courtListMatch
        ? courtListMatch[1]
            .split(',')
            .map((n) => parseInt(n.trim(), 10))
            .filter((n) => !isNaN(n))
        : Array.from(
            { length: Math.max(1, Number(booking.courtCount || 1)) },
            (_, idx) => idx + 1
          );

      const movedFromSet = new Set(items.map((it) => it.fromCourt));
      const newTargetCourts = items
        .map((it) => it.toCourt)
        .sort((a, b) => a - b);
      const untouchedCourts = existingCourts
        .filter((c) => !movedFromSet.has(c))
        .sort((a, b) => a - b);

      const updateFilter =
        booking.dbId &&
        (UUID_REGEX.test(booking.dbId) || /^\d+$/.test(booking.dbId))
          ? { col: 'id', val: booking.dbId }
          : { col: 'booking_code', val: booking.id };

      if (untouchedCourts.length === 0) {
        const updatedLabel =
          newTargetCourts.length === 1
            ? `${slotRange} · Court ${newTargetCourts[0]}`
            : `${slotRange} · Courts ${newTargetCourts.join(', ')}`;

        const { data: updatedRows, error } = await supabase
          .from('bookings')
          .update({
            time_slot: updatedLabel,
            booking_time: updatedLabel,
          })
          .eq(updateFilter.col, updateFilter.val)
          .select('id');

        if (error) throw error;
        if (!updatedRows || updatedRows.length === 0) {
          throw new Error(
            'Database permission (RLS) blocked updating one of the bookings.'
          );
        }
      } else {
        const remainingLabel =
          untouchedCourts.length === 1
            ? `${slotRange} · Court ${untouchedCourts[0]}`
            : `${slotRange} · Courts ${untouchedCourts.join(', ')}`;

        const swappedLabel =
          newTargetCourts.length === 1
            ? `${slotRange} · Court ${newTargetCourts[0]}`
            : `${slotRange} · Courts ${newTargetCourts.join(', ')}`;

        const unitPrice =
          existingCourts.length > 0
            ? Number(booking.price || 0) / existingCourts.length
            : Number(booking.price || 0);
        const remainingPrice =
          Math.round(unitPrice * untouchedCourts.length * 100) / 100;
        const swappedPrice =
          Math.round(unitPrice * newTargetCourts.length * 100) / 100;

        const { data: updatedRows, error: updateErr } = await supabase
          .from('bookings')
          .update({
            time_slot: remainingLabel,
            booking_time: remainingLabel,
            court_count: untouchedCourts.length,
            price: remainingPrice,
            total_amount: remainingPrice,
          })
          .eq(updateFilter.col, updateFilter.val)
          .select('id');

        if (updateErr) throw updateErr;
        if (!updatedRows || updatedRows.length === 0) {
          throw new Error(
            'Database permission (RLS) blocked updating one of the bookings.'
          );
        }

        const newCode = `MTN-${Math.random()
          .toString(36)
          .substring(2, 8)
          .toUpperCase()}`;
        const { error: insertErr } = await supabase.from('bookings').insert({
          booking_code: newCode,
          venue_id: selectedVenue.id,
          venue_name: selectedVenue.name,
          sport:
            booking.sport ||
            selectedMatrixSport ||
            venueSportOptions[0] ||
            'Badminton',
          booking_date: booking.date,
          booking_time: swappedLabel,
          time_slot: swappedLabel,
          court_count: newTargetCourts.length,
          price: swappedPrice,
          total_amount: swappedPrice,
          status: 'Confirmed',
          customer_name: booking.customerName || 'Player',
          customer_email: booking.customerEmail || '',
          user_id: booking.userId || null,
        });

        if (insertErr) throw insertErr;
      }
    }
  };

  // Handle Drag & Drop between two cells on the same timeslot
  const handleDropOnCell = async (targetCourt: number, targetTime: string) => {
    setDragOverKey(null);
    if (!isSwapMode || !draggedCell || !selectedVenue) return;

    const source = draggedCell;
    setDraggedCell(null);

    if (source.court === targetCourt && source.time === targetTime) return;
    if (source.time !== targetTime) {
      alert('Drag and drop across courts within the same timeslot row (e.g. 13:00).');
      return;
    }

    const targetBooking = bookedCellMap[`C${targetCourt}_${targetTime}`];
    const moves: {
      booking: DashboardBooking;
      fromCourt: number;
      toCourt: number;
      time: string;
    }[] = [
      {
        booking: source.booking,
        fromCourt: source.court,
        toCourt: targetCourt,
        time: targetTime,
      },
    ];

    if (targetBooking) {
      moves.push({
        booking: targetBooking,
        fromCourt: targetCourt,
        toCourt: source.court,
        time: targetTime,
      });
    }

    setIsSwapping(true);
    try {
      await applyCourtMoves(moves);
      setSelectedBookedCells([]);
      await fetchVenueBookings();
    } catch (err: any) {
      console.error('Error swapping courts via drag & drop:', err);
      alert(`Could not swap courts: ${err.message}`);
    } finally {
      setIsSwapping(false);
    }
  };

  const handleCellClick = (courtNum: number, time: string) => {
    if (isSwapMode) return;

    const cellKey = `C${courtNum}_${time}`;
    const existingBooking = bookedCellMap[cellKey];

    if (existingBooking) {
      if (isBookingMode) {
        setIsBookingMode(false);
        setSelectedSlots([]);
      }
      setSelectedBookedCells((prev) => {
        const exists = prev.some((c) => c.key === cellKey);
        if (exists) {
          return prev.filter((c) => c.key !== cellKey);
        }
        return [
          ...prev,
          { key: cellKey, court: courtNum, time, booking: existingBooking },
        ];
      });
      return;
    }

    if (isBookingMode) {
      setSelectedSlots((prev) => {
        const exists = prev.some((s) => s.court === courtNum && s.time === time);
        if (exists) {
          return prev.filter((s) => !(s.court === courtNum && s.time === time));
        }
        return [...prev, { court: courtNum, time }];
      });
    }
  };

  const handleConfirmFrontDeskBooking = async () => {
    if (!selectedVenue || selectedSlots.length === 0) return;

    setIsSubmittingBooking(true);
    try {
      const guestName = walkInName.trim() || 'Walk-in Player';
      const frontDeskEmail = user?.email || 'frontdesk@motion.app';
      const bookingSport =
        selectedMatrixSport || venueSportOptions[0] || 'Badminton';

      const results = await Promise.all(
        selectedSlots.map((slot) =>
          bookingService.createViaRPC({
            venueId: selectedVenue.id,
            venueName: selectedVenue.name,
            sport: bookingSport,
            date: selectedDate,
            timeSlot: `${toFullSlotLabel(slot.time)} · Court ${slot.court}`,
            courtCount: 1,
            totalPrice: sportHourlyRate,
            customerName: `${guestName} (Front Desk)`,
            customerEmail: frontDeskEmail,
            totalCourts: Number(totalCourts),
          })
        )
      );

      const failed = results.find((r) => !r.success);
      if (failed) {
        throw new Error(failed.error || 'One or more slots failed to book.');
      }

      await fetchVenueBookings();
      setSelectedSlots([]);
      setWalkInName('');
      setIsBookingMode(false);
    } catch (err: any) {
      console.error('Front-desk booking error:', err);
      alert(`Failed to create booking: ${err.message}`);
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  const handleCancelReservation = async (booking: DashboardBooking) => {
    const targetId = booking.dbId || booking.id;

    setVenueBookings((prev) =>
      prev.map((b) =>
        (b.dbId || b.id) === targetId ? { ...b, status: 'Cancelled' } : b
      )
    );

    const ok = await bookingService.cancel(targetId);
    if (!ok) {
      alert(
        'Could not cancel booking in Supabase. Please make sure your bookings UPDATE policy allows venue owners to update bookings.'
      );
      await fetchVenueBookings();
      return;
    }

    if (onCancel) {
      onCancel(booking.id);
    }
  };

  const handleBulkCancelSelected = async () => {
    if (selectedBookedCells.length === 0) return;

    const uniqueBookings = Array.from(
      new Map(
        selectedBookedCells.map((c) => [c.booking.dbId || c.booking.id, c.booking])
      ).values()
    );

    setIsProcessingBookedAction(true);
    try {
      const targetIds = new Set(uniqueBookings.map((b) => b.dbId || b.id));

      setVenueBookings((prev) =>
        prev.map((b) =>
          targetIds.has(b.dbId || b.id) ? { ...b, status: 'Cancelled' } : b
        )
      );

      const results = await Promise.all(
        uniqueBookings.map((b) => bookingService.cancel(b.dbId || b.id))
      );

      if (results.some((ok) => !ok)) {
        alert(
          'One or more bookings could not be cancelled in Supabase. Check your bookings UPDATE policy.'
        );
      } else if (onCancel) {
        uniqueBookings.forEach((b) => onCancel(b.id));
      }

      setSelectedBookedCells([]);
      await fetchVenueBookings();
    } finally {
      setIsProcessingBookedAction(false);
    }
  };

  const handleMoveSelectedToCourt = async () => {
    if (selectedBookedCells.length === 0 || !selectedVenue) return;

    setIsProcessingBookedAction(true);
    try {
      const moves = selectedBookedCells.map((cell) => ({
        booking: cell.booking,
        fromCourt: cell.court,
        toCourt: targetMoveCourt,
        time: cell.time,
      }));
      await applyCourtMoves(moves);
      setSelectedBookedCells([]);
      await fetchVenueBookings();
    } catch (err: any) {
      console.error('Error moving bookings:', err);
      alert(`Could not move booking: ${err.message}`);
    } finally {
      setIsProcessingBookedAction(false);
    }
  };

  // Save per-sport court count, hourly rate & operating hours
  const handleSaveConfig = async () => {
    if (!selectedVenue?.id) {
      alert('No venue selected to update.');
      return;
    }

    setIsSaving(true);
    try {
      const existingConfigs: Record<string, SportConfig> = {
        ...((selectedVenue as any).sport_configs || {}),
      };
      const currentSportKey =
        selectedMatrixSport || venueSportOptions[0] || 'Badminton';

      // Ensure all known sports at this venue have a config entry
      venueSportOptions.forEach((s) => {
        if (!existingConfigs[s]) {
          existingConfigs[s] = {
            total_courts: Number(selectedVenue.total_courts ?? 1),
            price_per_hour: Number(
              selectedVenue.price_per_hour ?? selectedVenue.price ?? 0
            ),
            operating_hours: {
              open_time: openTime,
              close_time: closeTime,
              slot_duration_minutes: 60,
            },
          };
        }
      });

      existingConfigs[currentSportKey] = {
        total_courts: Number(totalCourts),
        price_per_hour: Number(sportHourlyRate),
        operating_hours: {
          open_time: openTime,
          close_time: closeTime,
          slot_duration_minutes: 60,
        },
      };

      const updatedSportsList = Array.from(
        new Set([...venueSportOptions, currentSportKey])
      );

      const totalAllSportCourts =
        Object.values(existingConfigs).reduce(
          (sum, cfg) => sum + Number(cfg?.total_courts || 0),
          0
        ) || Number(totalCourts);

      const matrixPayload = {
        total_courts: totalAllSportCourts,
        sports: updatedSportsList,
        sport_configs: existingConfigs,
        operating_hours: {
          open_time: openTime,
          close_time: closeTime,
          slot_duration_minutes: 60,
        },
      };

      const res = await partnerService.updateVenueMatrix(
        selectedVenue.id,
        matrixPayload
      );

      if (res.success) {
        const dbRecord = Array.isArray(res.data) ? res.data[0] : res.data;

        const mergedVenue: Venue = {
          ...selectedVenue,
          sport: updatedSportsList.join(', '),
          price:
            selectedVenue.price ??
            dbRecord?.price ??
            dbRecord?.price_per_hour ??
            sportHourlyRate,
          price_per_hour:
            selectedVenue.price_per_hour ??
            dbRecord?.price_per_hour ??
            sportHourlyRate,
          facilities: selectedVenue.facilities || [],
          slots: selectedVenue.slots || [],
          ...matrixPayload,
          ...(dbRecord || {}),
        };

        if (onVenueUpdate) {
          onVenueUpdate(mergedVenue);
        }
        setIsEditingConfig(false);
      } else {
        alert(`Supabase save error: ${res.error}`);
      }
    } catch (err: any) {
      console.error('Failed to update venue configuration:', err);
      alert(`Save error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Add another sport directly from the Venue Control Centre
  const handleAddSportToVenue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVenue?.id || !newSportName) return;

    setIsAddingSport(true);
    try {
      const formattedSport = formatSportLabel(newSportName);
      const existingConfigs: Record<string, SportConfig> = {
        ...((selectedVenue as any).sport_configs || {}),
      };

      venueSportOptions.forEach((s) => {
        if (!existingConfigs[s]) {
          existingConfigs[s] = {
            total_courts: Number(selectedVenue.total_courts ?? 1),
            price_per_hour: Number(
              selectedVenue.price_per_hour ?? selectedVenue.price ?? 0
            ),
            operating_hours: {
              open_time: openTime,
              close_time: closeTime,
              slot_duration_minutes: 60,
            },
          };
        }
      });

      existingConfigs[formattedSport] = {
        total_courts: Math.max(1, Number(newSportCourts)),
        price_per_hour: Math.max(0, Number(newSportRate)),
        operating_hours: {
          open_time: openTime,
          close_time: closeTime,
          slot_duration_minutes: 60,
        },
      };

      const updatedSportsList = Array.from(
        new Set([...venueSportOptions, formattedSport])
      );

      const totalAllSportCourts = Object.values(existingConfigs).reduce(
        (sum, cfg) => sum + Number(cfg?.total_courts || 0),
        0
      );

      const res = await partnerService.updateVenueMatrix(selectedVenue.id, {
        total_courts: totalAllSportCourts,
        sports: updatedSportsList,
        sport_configs: existingConfigs,
        operating_hours: {
          open_time: openTime,
          close_time: closeTime,
          slot_duration_minutes: 60,
        },
      });

      if (!res.success) {
        alert(`Could not add sport: ${res.error}`);
        return;
      }

      const mergedVenue: Venue = {
        ...selectedVenue,
        sport: updatedSportsList.join(', '),
        total_courts: totalAllSportCourts,
        ...( { sports: updatedSportsList, sport_configs: existingConfigs } as any ),
      };

      if (onVenueUpdate) {
        onVenueUpdate(mergedVenue);
      }

      setSelectedMatrixSport(formattedSport);
      setShowAddSportModal(false);
    } finally {
      setIsAddingSport(false);
    }
  };

  const remainingAddableSports = useMemo(() => {
    const existingUpper = new Set(
      venueSportOptions.map((s) => s.toUpperCase())
    );
    return ADDABLE_SPORTS.filter((s) => !existingUpper.has(s.toUpperCase()));
  }, [venueSportOptions]);

  const totalSelectedAmount = selectedSlots.length * sportHourlyRate;
  const openHourNum = parseInt(openTime.split(':')[0], 10);

  return (
    <section className="mx-auto min-h-[85vh] max-w-6xl px-5 py-6 lg:px-8 lg:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-black/10 dark:border-white/10 pb-4">
        <p className="text-xs font-black uppercase tracking-[.2em] text-[#81971d] dark:text-[#d8ff3e]">
          {activeRole === 'venue'
            ? `${selectedVenue?.name || 'Venue'} Control Centre`
            : 'Coach Control Centre'}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          {activeRole === 'venue' && ownedVenues.length > 1 && (
            <select
              value={selectedVenue?.id || ''}
              onChange={(e) => {
                setSelectedVenueId(e.target.value);
                setSelectedMatrixSport('');
                setIsEditingConfig(false);
                setIsBookingMode(false);
                setSelectedSlots([]);
                setSelectedBookedCells([]);
                resetSwapMode();
                setMasterVisibleCount(10);
              }}
              className="rounded-xl border border-black/15 dark:border-white/10 bg-white dark:bg-[#16171A] px-3 py-2 text-xs font-bold text-[#101310] dark:text-[#F7F8F4] outline-none"
            >
              {ownedVenues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          )}

          {hasBothRoles ? (
            <div className="flex items-center rounded-2xl border border-black/10 dark:border-white/10 bg-[#f7f8f4] dark:bg-[#16171A] p-1">
              <button
                onClick={() => setActiveRole('venue')}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition ${
                  activeRole === 'venue'
                    ? 'bg-[#101310] dark:bg-[#d8ff3e] text-[#d8ff3e] dark:text-[#101310] shadow-sm'
                    : 'text-black/60 dark:text-[#F7F8F4]/70 hover:text-black dark:hover:text-[#F7F8F4]'
                }`}
              >
                <Building2 size={15} /> Venue Owner
              </button>
              <button
                onClick={() => setActiveRole('coach')}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition ${
                  activeRole === 'coach'
                    ? 'bg-[#101310] dark:bg-[#d8ff3e] text-[#d8ff3e] dark:text-[#101310] shadow-sm'
                    : 'text-black/60 dark:text-[#F7F8F4]/70 hover:text-black dark:hover:text-[#F7F8F4]'
                }`}
              >
                <UserCheck size={15} /> Coach Portal
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-2xl bg-[#101310] dark:bg-[#d8ff3e] px-4 py-2 text-xs font-black text-[#d8ff3e] dark:text-[#101310] shadow-sm">
              {activeRole === 'coach' ? (
                <>
                  <UserCheck size={15} /> Coach Portal
                </>
              ) : (
                <>
                  <Building2 size={15} /> Venue Owner
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {activeRole === 'venue' &&
        (selectedVenue ? (
          <>
            {/* COMPACT COURT & TIMESLOT MATRIX */}
            <div className="mt-5 rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#16171A] p-5 sm:p-6 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-black/10 dark:border-white/10 pb-4">
                <div>
                  <h2 className="text-xl font-black tracking-tight text-[#101310] dark:text-[#F7F8F4]">
                    Court & Timeslot Matrix
                  </h2>
                  <p className="mt-0.5 text-xs text-black/50 dark:text-[#F7F8F4]/60">
                    {isSwapMode
                      ? `Swapping Mode Active (${selectedMatrixSport}): Drag any red booked slot and drop it onto another court in the same hour to swap or move.`
                      : isBookingMode
                      ? `Select one or more open white ${selectedMatrixSport} slots below, then confirm to book.`
                      : `Showing ${selectedMatrixSport} (${totalCourts} ${
                          totalCourts === 1 ? 'court' : 'courts'
                        } · ${money(sportHourlyRate)}/hr) — click red slots to select, move, or cancel.`}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* DATE PICKER */}
                  <label className="flex items-center gap-2 rounded-xl border border-black/15 dark:border-white/10 bg-[#f7f8f4] dark:bg-[#0B0B0C] px-3 py-1.5 text-xs font-bold text-[#101310] dark:text-[#F7F8F4]">
                    <Calendar size={15} />
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => {
                        setSelectedDate(e.target.value);
                        setSelectedSlots([]);
                        setSelectedBookedCells([]);
                        resetSwapMode();
                      }}
                      className="bg-transparent outline-none"
                    />
                  </label>

                  {/* BOOK COURT BUTTON */}
                  <button
                    type="button"
                    onClick={() => {
                      if (isEditingConfig) setIsEditingConfig(false);
                      resetSwapMode();
                      setSelectedBookedCells([]);
                      setIsBookingMode((prev) => {
                        if (prev) setSelectedSlots([]);
                        return !prev;
                      });
                    }}
                    className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold transition ${
                      isBookingMode
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'bg-[#d8ff3e] text-[#101310] border border-black/15 dark:border-transparent hover:bg-[#cbf528]'
                    }`}
                  >
                    {isBookingMode ? (
                      <>
                        <X size={14} /> Cancel Selection
                      </>
                    ) : (
                      <>
                        <PlusCircle size={14} /> Book Court
                      </>
                    )}
                  </button>

                  {/* SWAP COURTS (DRAG & DROP MODE) BUTTON */}
                  <button
                    type="button"
                    onClick={() => {
                      if (isEditingConfig) setIsEditingConfig(false);
                      if (isBookingMode) {
                        setIsBookingMode(false);
                        setSelectedSlots([]);
                      }
                      setSelectedBookedCells([]);
                      if (isSwapMode) {
                        resetSwapMode();
                      } else {
                        setIsSwapMode(true);
                      }
                    }}
                    className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold transition ${
                      isSwapMode
                        ? 'bg-amber-500 text-[#101310] border border-black/20 hover:bg-amber-400'
                        : 'border border-black/15 dark:border-white/10 bg-[#f7f8f4] dark:bg-[#0B0B0C] text-[#101310] dark:text-[#F7F8F4] hover:bg-[#eef7cf] dark:hover:bg-white/10'
                    }`}
                  >
                    {isSwapMode ? (
                      <>
                        <Check size={14} /> Done Swapping
                      </>
                    ) : (
                      <>
                        <ArrowRightLeft size={14} /> Swap Courts
                      </>
                    )}
                  </button>

                  {/* EDIT SETTINGS BUTTON */}
                  <button
                    type="button"
                    onClick={() => {
                      if (isBookingMode) {
                        setIsBookingMode(false);
                        setSelectedSlots([]);
                      }
                      resetSwapMode();
                      setSelectedBookedCells([]);
                      if (isEditingConfig) {
                        handleSaveConfig();
                      } else {
                        setIsEditingConfig(true);
                      }
                    }}
                    disabled={isSaving}
                    className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold transition ${
                      isEditingConfig
                        ? 'bg-[#d8ff3e] text-[#101310] border border-black/20 hover:bg-[#cbf528]'
                        : 'bg-[#101310] dark:bg-[#0B0B0C] dark:border dark:border-white/10 text-white dark:text-[#F7F8F4] hover:bg-black/80 dark:hover:bg-white/10'
                    }`}
                  >
                    {isSaving ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : isEditingConfig ? (
                      <>
                        <Check size={14} /> Save Config
                      </>
                    ) : (
                      <>
                        <Edit2 size={14} /> Edit Settings
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* SPORT SWITCHER BAR (TABS FOR EACH SPORT + ADD SPORT) */}
              <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {venueSportOptions.map((sport) => {
                    const isSelected =
                      sport.toUpperCase() === selectedMatrixSport.toUpperCase();
                    return (
                      <button
                        key={sport}
                        type="button"
                        onClick={() => {
                          setSelectedMatrixSport(sport);
                          setSelectedSlots([]);
                          setSelectedBookedCells([]);
                          setIsEditingConfig(false);
                          resetSwapMode();
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-black transition ${
                          isSelected
                            ? 'border-[#101310] dark:border-[#d8ff3e] bg-[#101310] dark:bg-[#d8ff3e] text-[#d8ff3e] dark:text-[#101310] shadow-xs'
                            : 'border-black/15 dark:border-white/10 bg-[#f7f8f4] dark:bg-[#0B0B0C] text-black/65 dark:text-[#F7F8F4]/70 hover:border-black/35 dark:hover:border-white/25'
                        }`}
                      >
                        <Trophy size={13} />
                        {sport}
                      </button>
                    );
                  })}

                  {remainingAddableSports.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setNewSportName(remainingAddableSports[0]);
                        setNewSportCourts(2);
                        setNewSportRate(sportHourlyRate || 350);
                        setShowAddSportModal((prev) => !prev);
                      }}
                      className="inline-flex items-center gap-1 rounded-xl border border-dashed border-black/25 dark:border-white/20 px-3 py-1.5 text-xs font-extrabold text-black/60 dark:text-[#F7F8F4]/70 transition hover:border-black dark:hover:border-[#d8ff3e] hover:text-[#101310] dark:hover:text-[#d8ff3e]"
                    >
                      <Plus size={13} /> Add Sport
                    </button>
                  )}
                </div>
              </div>

              {/* INLINE ADD SPORT PANEL */}
              {showAddSportModal && remainingAddableSports.length > 0 && (
                <form
                  onSubmit={handleAddSportToVenue}
                  className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-[#81971d]/40 dark:border-[#d8ff3e]/30 bg-[#f0f7db] dark:bg-[#d8ff3e]/10 p-3 text-xs"
                >
                  <span className="font-black text-[#101310] dark:text-[#F7F8F4]">
                    Add Sport:
                  </span>

                  <select
                    value={newSportName}
                    onChange={(e) => setNewSportName(e.target.value)}
                    className="rounded-lg border border-black/15 dark:border-white/15 bg-white dark:bg-[#0B0B0C] px-2.5 py-1.5 font-extrabold text-[#101310] dark:text-[#F7F8F4] outline-none"
                  >
                    {remainingAddableSports.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>

                  <label className="flex items-center gap-1.5 font-bold text-[#101310] dark:text-[#F7F8F4]">
                    <span>Courts:</span>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={newSportCourts}
                      onChange={(e) =>
                        setNewSportCourts(Math.max(1, Number(e.target.value)))
                      }
                      className="w-16 rounded-lg border border-black/15 dark:border-white/15 bg-white dark:bg-[#0B0B0C] px-2 py-1 text-center font-extrabold outline-none"
                    />
                  </label>

                  <label className="flex items-center gap-1.5 font-bold text-[#101310] dark:text-[#F7F8F4]">
                    <span>Rate (฿/hr):</span>
                    <input
                      type="number"
                      min={0}
                      value={newSportRate}
                      onChange={(e) =>
                        setNewSportRate(Math.max(0, Number(e.target.value)))
                      }
                      className="w-20 rounded-lg border border-black/15 dark:border-white/15 bg-white dark:bg-[#0B0B0C] px-2 py-1 text-center font-extrabold outline-none"
                    />
                  </label>

                  <div className="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddSportModal(false)}
                      className="rounded-lg border border-black/15 dark:border-white/15 bg-white dark:bg-[#0B0B0C] px-3 py-1.5 font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isAddingSport}
                      className="rounded-lg bg-[#101310] dark:bg-[#d8ff3e] px-3.5 py-1.5 font-black text-[#d8ff3e] dark:text-[#101310] disabled:opacity-50"
                    >
                      {isAddingSport ? 'Adding...' : 'Save Sport'}
                    </button>
                  </div>
                </form>
              )}

              {/* DRAG & DROP SWAPPING MODE BANNER */}
              {isSwapMode && (
                <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-amber-300 dark:border-amber-500/40 bg-amber-50/90 dark:bg-amber-500/15 px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 font-bold text-black/80 dark:text-amber-200">
                    <GripVertical size={15} className="shrink-0 text-amber-700 dark:text-amber-400" />
                    <span>
                      {isSwapping
                        ? 'Updating court assignment in Supabase...'
                        : draggedCell
                        ? `Dragging ${
                            draggedCell.booking.customerName || 'Walk-in'
                          } from Court ${draggedCell.court} (${
                            draggedCell.time
                          }) — drop onto any court at ${draggedCell.time}`
                        : 'Drag any booked red cell left or right and drop it onto another court in the same hour to swap or move.'}
                    </span>
                  </div>

                  {isSwapping && (
                    <span className="flex items-center gap-1.5 font-black text-amber-800 dark:text-amber-300">
                      <Loader2 size={14} className="animate-spin" /> Swapping...
                    </span>
                  )}
                </div>
              )}

              {/* SELECTED BOOKED SLOTS ACTION BAR (MOVE OR CANCEL) */}
              {!isSwapMode && selectedBookedCells.length > 0 && (
                <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-red-200 dark:border-red-500/30 bg-red-50/80 dark:bg-red-500/10 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5 text-xs">
                    <span className="rounded-lg bg-red-600 px-2.5 py-1 font-black text-white">
                      {selectedBookedCells.length} Booked{' '}
                      {selectedBookedCells.length === 1 ? 'Slot' : 'Slots'} Selected
                    </span>
                    <span className="line-clamp-2 font-semibold text-black/70 dark:text-[#F7F8F4]/80">
                      {Array.from(
                        new Set(
                          selectedBookedCells.map(
                            (c) =>
                              c.booking.customerName ||
                              c.booking.customerEmail ||
                              'Walk-in'
                          )
                        )
                      ).join(', ')}
                    </span>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 rounded-xl border border-black/15 dark:border-white/10 bg-white dark:bg-[#0B0B0C] px-2.5 py-1 text-xs font-bold">
                      <ArrowRightLeft size={13} className="text-black/50 dark:text-[#F7F8F4]/50" />
                      <span className="text-black/60 dark:text-[#F7F8F4]/60">Move to:</span>
                      <select
                        value={targetMoveCourt}
                        disabled={
                          isProcessingBookedAction || validMoveCourts.length === 0
                        }
                        onChange={(e) => setTargetMoveCourt(Number(e.target.value))}
                        className="bg-transparent font-extrabold text-[#101310] dark:text-[#F7F8F4] outline-none"
                      >
                        {Array.from({ length: totalCourts }).map((_, idx) => {
                          const cNum = idx + 1;
                          const canMoveHere = validMoveCourts.includes(cNum);
                          return (
                            <option
                              key={cNum}
                              value={cNum}
                              disabled={!canMoveHere}
                            >
                              Court {cNum} {!canMoveHere ? '(Occupied)' : ''}
                            </option>
                          );
                        })}
                      </select>
                      <button
                        type="button"
                        disabled={
                          isProcessingBookedAction ||
                          validMoveCourts.length === 0 ||
                          selectedBookedCells.every(
                            (c) => c.court === targetMoveCourt
                          )
                        }
                        onClick={handleMoveSelectedToCourt}
                        className="ml-1 rounded-lg bg-[#101310] dark:bg-[#d8ff3e] px-3 py-1 text-[11px] font-black text-[#d8ff3e] dark:text-[#101310] transition hover:bg-black/85 dark:hover:bg-[#c9f02e] disabled:opacity-40"
                      >
                        {isProcessingBookedAction ? 'Moving...' : 'Move'}
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={isProcessingBookedAction}
                      onClick={handleBulkCancelSelected}
                      className="flex items-center gap-1 rounded-xl bg-red-600 px-3.5 py-1.5 text-xs font-black text-white transition hover:bg-red-700 disabled:opacity-40"
                    >
                      {isProcessingBookedAction ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <XCircle size={13} />
                      )}
                      Cancel Selected ({selectedBookedCells.length})
                    </button>

                    <button
                      type="button"
                      disabled={isProcessingBookedAction}
                      onClick={() => setSelectedBookedCells([])}
                      className="rounded-xl border border-black/15 dark:border-white/10 bg-white dark:bg-[#0B0B0C] px-2.5 py-1.5 text-xs font-bold text-black/60 dark:text-[#F7F8F4]/70 hover:text-black dark:hover:text-[#F7F8F4]"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}

              {/* FRONT-DESK BOOKING CHECKOUT BAR */}
              {isBookingMode && (
                <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-[#81971d]/40 dark:border-[#d8ff3e]/30 bg-[#f0f7db] dark:bg-[#d8ff3e]/10 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <span className="rounded-lg bg-[#101310] dark:bg-[#d8ff3e] px-2.5 py-1 font-black text-[#d8ff3e] dark:text-[#101310]">
                      {selectedSlots.length} {selectedMatrixSport}{' '}
                      {selectedSlots.length === 1 ? 'Slot' : 'Slots'} Selected
                    </span>
                    <span className="font-extrabold text-[#101310] dark:text-[#F7F8F4]">
                      Total: {money(totalSelectedAmount)}
                    </span>
                    <input
                      type="text"
                      value={walkInName}
                      onChange={(e) => setWalkInName(e.target.value)}
                      placeholder="Player name / phone (optional)"
                      className="rounded-lg border border-black/15 dark:border-white/10 bg-white dark:bg-[#0B0B0C] px-3 py-1.5 text-xs font-medium text-[#101310] dark:text-[#F7F8F4] outline-none w-52"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={selectedSlots.length === 0 || isSubmittingBooking}
                    onClick={handleConfirmFrontDeskBooking}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-[#101310] dark:bg-[#d8ff3e] px-5 py-2 text-xs font-black text-[#d8ff3e] dark:text-[#101310] transition hover:bg-black/85 dark:hover:bg-[#c9f02e] disabled:opacity-40"
                  >
                    {isSubmittingBooking ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Booking...
                      </>
                    ) : (
                      <>
                        <Check size={14} /> Confirm & Book ({selectedSlots.length})
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* COURTS, RATE & HOURS CONFIG BAR (PER SPORT) */}
              {!isBookingMode && !isSwapMode && selectedBookedCells.length === 0 && (
                <div
                  className={`mt-3 flex flex-wrap items-center gap-6 rounded-xl px-3 py-2 text-xs font-bold transition ${
                    isEditingConfig
                      ? 'bg-[#f0f7db] dark:bg-[#d8ff3e]/10 border border-[#d0e588] dark:border-[#d8ff3e]/30'
                      : 'bg-[#f7f8f4] dark:bg-[#0B0B0C]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Sliders size={14} className="text-black/50 dark:text-[#F7F8F4]/50" />
                    <span>{selectedMatrixSport} Courts:</span>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      disabled={!isEditingConfig}
                      value={totalCourts}
                      onChange={(e) =>
                        setTotalCourts(Math.max(1, Number(e.target.value)))
                      }
                      className={`w-14 rounded border px-2 py-0.5 text-center font-bold outline-none ${
                        isEditingConfig
                          ? 'bg-white dark:bg-[#16171A] border-black/30 dark:border-white/20 text-[#101310] dark:text-[#F7F8F4] ring-2 ring-[#81971d]/40 dark:ring-[#d8ff3e]/40'
                          : 'bg-black/5 dark:bg-white/5 border-transparent text-black/60 dark:text-[#F7F8F4]/60 cursor-not-allowed'
                      }`}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <DollarSign size={14} className="text-black/50 dark:text-[#F7F8F4]/50" />
                    <span>Rate (฿/hr):</span>
                    <input
                      type="number"
                      min={0}
                      disabled={!isEditingConfig}
                      value={sportHourlyRate}
                      onChange={(e) =>
                        setSportHourlyRate(Math.max(0, Number(e.target.value)))
                      }
                      className={`w-20 rounded border px-2 py-0.5 text-center font-bold outline-none ${
                        isEditingConfig
                          ? 'bg-white dark:bg-[#16171A] border-black/30 dark:border-white/20 text-[#101310] dark:text-[#F7F8F4] ring-2 ring-[#81971d]/40 dark:ring-[#d8ff3e]/40'
                          : 'bg-black/5 dark:bg-white/5 border-transparent text-black/60 dark:text-[#F7F8F4]/60 cursor-not-allowed'
                      }`}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-black/50 dark:text-[#F7F8F4]/50" />
                    <span>Operating Hours:</span>
                    <select
                      disabled={!isEditingConfig}
                      value={openTime}
                      onChange={(e) => handleOpenTimeChange(e.target.value)}
                      className={`rounded-lg border px-2 py-0.5 outline-none ${
                        isEditingConfig
                          ? 'bg-white dark:bg-[#16171A] border-black/30 dark:border-white/20 text-[#101310] dark:text-[#F7F8F4]'
                          : 'bg-black/5 dark:bg-white/5 border-transparent text-black/60 dark:text-[#F7F8F4]/60 cursor-not-allowed'
                      }`}
                    >
                      {DEFAULT_HOURS.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                    <span>to</span>
                    <select
                      disabled={!isEditingConfig}
                      value={closeTime}
                      onChange={(e) => setCloseTime(e.target.value)}
                      className={`rounded-lg border px-2 py-0.5 outline-none ${
                        isEditingConfig
                          ? 'bg-white dark:bg-[#16171A] border-black/30 dark:border-white/20 text-[#101310] dark:text-[#F7F8F4]'
                          : 'bg-black/5 dark:bg-white/5 border-transparent text-black/60 dark:text-[#F7F8F4]/60 cursor-not-allowed'
                      }`}
                    >
                      {DEFAULT_HOURS.map((h) => {
                        const hNum = parseInt(h.split(':')[0], 10);
                        const isInvalidClose = h !== '00:00' && hNum <= openHourNum;
                        return (
                          <option key={h} value={h} disabled={isInvalidClose}>
                            {h}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              )}

              {/* MATRIX TABLE */}
              <div className="mt-4 overflow-x-auto rounded-xl border border-black/15 dark:border-white/10">
                <table className="w-full table-fixed text-left border-separate border-spacing-0 min-w-[600px]">
                  <thead>
                    <tr className="bg-[#101310] text-white text-[11px] font-black uppercase">
                      <th className="px-3 py-2 border-r border-white/10 w-24">
                        Time
                      </th>
                      {Array.from({ length: totalCourts }).map((_, i) => (
                        <th
                          key={i}
                          className="px-2 py-2 text-center border-r border-white/10 last:border-r-0"
                        >
                          {selectedMatrixSport} {i + 1}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {activeHours.map((time, rowIdx) => (
                      <tr key={time}>
                        <td
                          className={`px-3 py-1 font-extrabold bg-[#f7f8f4] dark:bg-[#0B0B0C] text-[#101310] dark:text-[#F7F8F4] border-r border-black/10 dark:border-white/10 ${
                            rowIdx > 0
                              ? 'border-t border-black/10 dark:border-white/10'
                              : ''
                          }`}
                        >
                          {time}
                        </td>
                        {Array.from({ length: totalCourts }).map((_, i) => {
                          const courtNum = i + 1;
                          const cellKey = `C${courtNum}_${time}`;
                          const booking = bookedCellMap[cellKey];
                          const isBooked = Boolean(booking);
                          const cluster = isBooked
                            ? bookingClusterMeta[cellKey]
                            : undefined;

                          const isBookedSelected = selectedBookedCells.some(
                            (c) => c.key === cellKey
                          );
                          const isBeingDragged = draggedCell?.key === cellKey;
                          const isValidDropTarget =
                            isSwapMode &&
                            Boolean(draggedCell) &&
                            draggedCell?.time === time &&
                            draggedCell?.key !== cellKey;
                          const isDragOverTarget =
                            isValidDropTarget && dragOverKey === cellKey;
                          const isOpenSelected = selectedSlots.some(
                            (s) => s.court === courtNum && s.time === time
                          );
                          const guestName = booking
                            ? getMatrixBookerLabel(booking)
                            : 'Walk-in';

                          const cellGridBorders = [
                            rowIdx > 0 && (!cluster || cluster.topEdge)
                              ? 'border-t border-black/10 dark:border-white/10'
                              : '',
                            i < totalCourts - 1 &&
                            (!cluster || cluster.rightEdge)
                              ? 'border-r border-black/10 dark:border-white/10'
                              : '',
                          ]
                            .filter(Boolean)
                            .join(' ');

                          const bookingPerimeterClasses = cluster
                            ? [
                                cluster.topEdge
                                  ? 'border-t-2 border-t-[#101310] dark:border-t-[#F7F8F4]'
                                  : '-mt-[1px] !h-[33px]',
                                cluster.bottomEdge
                                  ? 'border-b-2 border-b-[#101310] dark:border-b-[#F7F8F4]'
                                  : '',
                                cluster.leftEdge
                                  ? 'border-l-2 border-l-[#101310] dark:border-l-[#F7F8F4]'
                                  : '',
                                cluster.rightEdge
                                  ? 'border-r-2 border-r-[#101310] dark:border-r-[#F7F8F4]'
                                  : '',
                              ]
                                .filter(Boolean)
                                .join(' ')
                            : '';

                          return (
                            <td
                              key={i}
                              onDragOver={(e) => {
                                if (isValidDropTarget) {
                                  e.preventDefault();
                                  if (dragOverKey !== cellKey) {
                                    setDragOverKey(cellKey);
                                  }
                                }
                              }}
                              onDragLeave={() => {
                                if (dragOverKey === cellKey) {
                                  setDragOverKey(null);
                                }
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                handleDropOnCell(courtNum, time);
                              }}
                              className={`relative p-0 ${cellGridBorders}`}
                            >
                              <button
                                type="button"
                                draggable={isSwapMode && isBooked && !isSwapping}
                                onDragStart={() => {
                                  if (isSwapMode && isBooked && booking) {
                                    setDraggedCell({
                                      key: cellKey,
                                      court: courtNum,
                                      time,
                                      booking,
                                    });
                                  }
                                }}
                                onDragEnd={() => {
                                  setDraggedCell(null);
                                  setDragOverKey(null);
                                }}
                                onClick={() => handleCellClick(courtNum, time)}
                                title={
                                  isSwapMode
                                    ? isBooked
                                      ? `Drag ${guestName} (Court ${courtNum}) to swap or move`
                                      : isValidDropTarget
                                      ? `Drop here to move to Court ${courtNum}`
                                      : 'Available'
                                    : isBooked
                                    ? isBookedSelected
                                      ? `Selected (${guestName}) — click to unselect`
                                      : `Booked (${guestName}) — click to select`
                                    : isBookingMode
                                    ? isOpenSelected
                                      ? 'Selected — click to unselect'
                                      : 'Click to select slot'
                                    : 'Available (click "Book Court" to book)'
                                }
                                className={`relative flex h-8 w-full items-center justify-center overflow-visible text-[11px] font-black transition-colors ${bookingPerimeterClasses} ${
                                  isBooked
                                    ? isBeingDragged
                                      ? 'bg-red-800 text-[#d8ff3e] opacity-60 cursor-grabbing'
                                      : isDragOverTarget
                                      ? 'bg-amber-400 text-[#101310]'
                                      : isSwapMode
                                      ? 'bg-red-500 text-white hover:bg-red-600 cursor-grab active:cursor-grabbing'
                                      : isBookedSelected
                                      ? 'bg-red-700 text-white cursor-pointer'
                                      : 'bg-red-500 text-white hover:bg-red-600 cursor-pointer'
                                    : isDragOverTarget
                                    ? 'bg-[#d8ff3e] text-[#101310] ring-2 ring-inset ring-black dark:ring-white'
                                    : isValidDropTarget
                                    ? 'bg-amber-50/70 dark:bg-amber-500/20'
                                    : isOpenSelected
                                    ? 'bg-[#d8ff3e] text-[#101310] ring-1 ring-inset ring-black/40 cursor-pointer'
                                    : isBookingMode
                                    ? 'bg-white dark:bg-[#16171A] hover:bg-[#eef7cf] dark:hover:bg-[#d8ff3e]/20 cursor-pointer'
                                    : 'bg-white dark:bg-[#16171A] cursor-default'
                                }`}
                              >
                                {isBooked && cluster?.showLabel && !isDragOverTarget && (
                                  <span
                                    style={{
                                      transform: `translate(${cluster.offsetXPercent}%, ${cluster.offsetYPercent}%)`,
                                    }}
                                    className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-1 text-center text-[11px] font-black leading-none tracking-tight text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)] whitespace-nowrap"
                                  >
                                    {cluster.label}
                                  </span>
                                )}

                                {isSwapMode && isBooked && !cluster?.showLabel ? (
                                  <GripVertical size={12} className="opacity-70" />
                                ) : isDragOverTarget ? (
                                  '⇄'
                                ) : isBookedSelected ? (
                                  <span className="absolute right-1 top-0.5 text-[9px] font-black text-[#d8ff3e]">
                                    ✓
                                  </span>
                                ) : (
                                  isOpenSelected && '✓'
                                )}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* COLLAPSIBLE VENUE STATISTICS */}
            <div className="mt-5">
              <button
                type="button"
                onClick={() => setShowVenueStats((prev) => !prev)}
                className="flex w-full items-center justify-between rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#16171A] px-6 py-4 text-left shadow-sm transition hover:border-black/25 dark:hover:border-white/25"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#eef7cf] dark:bg-[#d8ff3e]/15 text-[#586c12] dark:text-[#d8ff3e]">
                    <BarChart3 size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-[#101310] dark:text-[#F7F8F4]">
                      {showVenueStats
                        ? 'Hide Venue Statistics'
                        : 'View More Venue Statistics'}
                    </p>
                    <p className="text-xs text-black/50 dark:text-[#F7F8F4]/60">
                      Revenue, bookings breakdown, cancellations & court
                      utilization
                    </p>
                  </div>
                </div>
                {showVenueStats ? (
                  <ChevronUp size={18} className="text-black/60 dark:text-[#F7F8F4]/60" />
                ) : (
                  <ChevronDown size={18} className="text-black/60 dark:text-[#F7F8F4]/60" />
                )}
              </button>

              {showVenueStats && (
                <div
                  className={`mt-4 grid grid-cols-2 gap-4 ${
                    isSuperAdmin ? 'lg:grid-cols-5' : 'lg:grid-cols-4'
                  }`}
                >
                  <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#16171A] p-6 shadow-sm">
                    <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-black/45 dark:text-[#F7F8F4]/50">
                      <span>TOTAL REVENUE</span>
                      <DollarSign size={18} className="text-[#81971d] dark:text-[#d8ff3e]" />
                    </div>
                    <p className="mt-2 text-3xl font-black text-[#101310] dark:text-[#F7F8F4]">
                      {money(stats.revenue)}
                    </p>
                  </div>

                  <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#16171A] p-6 shadow-sm">
                    <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-black/45 dark:text-[#F7F8F4]/50">
                      <span>ACTIVE BOOKINGS</span>
                      <CheckCircle2 size={18} className="text-green-600 dark:text-green-400" />
                    </div>
                    <p className="mt-2 text-3xl font-black text-[#101310] dark:text-[#F7F8F4]">
                      {stats.activeCount}
                    </p>
                  </div>

                  <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#16171A] p-6 shadow-sm">
                    <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-black/45 dark:text-[#F7F8F4]/50">
                      <span>CANCELLATIONS</span>
                      <XCircle size={18} className="text-red-500 dark:text-red-400" />
                    </div>
                    <p className="mt-2 text-3xl font-black text-[#101310] dark:text-[#F7F8F4]">
                      {stats.cancelCount}
                    </p>
                  </div>

                  <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#16171A] p-6 shadow-sm">
                    <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-black/45 dark:text-[#F7F8F4]/50">
                      <span>UTILIZATION ({selectedDate})</span>
                      <TrendingUp size={18} className="text-[#81971d] dark:text-[#d8ff3e]" />
                    </div>
                    <p className="mt-2 text-3xl font-black text-[#101310] dark:text-[#F7F8F4]">
                      {stats.occupancyRate}%
                    </p>
                  </div>

                  {isSuperAdmin && (
                    <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#16171A] p-6 shadow-sm">
                      <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-black/45 dark:text-[#F7F8F4]/50">
                        <span>VENUES LISTED</span>
                        <Building2 size={18} className="text-black/50 dark:text-[#F7F8F4]/50" />
                      </div>
                      <p className="mt-2 text-3xl font-black text-[#101310] dark:text-[#F7F8F4]">
                        {stats.listings}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* VENUE MASTER RESERVATION LIST */}
            <div className="mt-8 rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#16171A] p-6 sm:p-8 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-[#101310] dark:text-[#F7F8F4]">
                    Master Reservation List
                  </h2>
                  <p className="mt-1 text-xs text-black/50 dark:text-[#F7F8F4]/60">
                    Showing {masterTimeTab === 'active' ? 'current & upcoming' : 'past'}{' '}
                    player bookings for {selectedVenue?.name || 'your venue'}.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="inline-flex items-center rounded-2xl border border-black/10 dark:border-white/10 bg-[#f7f8f4] dark:bg-[#0B0B0C] p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMasterTimeTab('active');
                        setMasterVisibleCount(10);
                      }}
                      className={`rounded-xl px-3.5 py-1.5 text-xs font-black transition ${
                        masterTimeTab === 'active'
                          ? 'bg-[#101310] dark:bg-[#d8ff3e] text-[#d8ff3e] dark:text-[#101310] shadow-sm'
                          : 'text-black/60 dark:text-[#F7F8F4]/70 hover:text-black dark:hover:text-[#F7F8F4]'
                      }`}
                    >
                      Current / Active ({activeTimeBookings.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMasterTimeTab('past');
                        setMasterVisibleCount(10);
                      }}
                      className={`rounded-xl px-3.5 py-1.5 text-xs font-black transition ${
                        masterTimeTab === 'past'
                          ? 'bg-[#101310] dark:bg-[#d8ff3e] text-[#d8ff3e] dark:text-[#101310] shadow-sm'
                          : 'text-black/60 dark:text-[#F7F8F4]/70 hover:text-black dark:hover:text-[#F7F8F4]'
                      }`}
                    >
                      Past ({pastTimeBookings.length})
                    </button>
                  </div>

                  <div className="inline-flex items-center rounded-2xl border border-black/10 dark:border-white/10 bg-[#f7f8f4] dark:bg-[#0B0B0C] p-1">
                    <button
                      type="button"
                      onClick={() => setMasterViewMode('list')}
                      className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition ${
                        masterViewMode === 'list'
                          ? 'bg-white dark:bg-[#16171A] text-[#101310] dark:text-[#F7F8F4] shadow-sm'
                          : 'text-black/55 dark:text-[#F7F8F4]/60 hover:text-black dark:hover:text-[#F7F8F4]'
                      }`}
                    >
                      <List size={14} />
                      List
                    </button>
                    <button
                      type="button"
                      onClick={() => setMasterViewMode('grid')}
                      className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition ${
                        masterViewMode === 'grid'
                          ? 'bg-white dark:bg-[#16171A] text-[#101310] dark:text-[#F7F8F4] shadow-sm'
                          : 'text-black/55 dark:text-[#F7F8F4]/60 hover:text-black dark:hover:text-[#F7F8F4]'
                      }`}
                    >
                      <LayoutGrid size={14} />
                      Grid
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search
                    size={15}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-black/40 dark:text-[#F7F8F4]/45"
                  />
                  <input
                    type="text"
                    value={masterSearchQuery}
                    onChange={(e) => {
                      setMasterSearchQuery(e.target.value);
                      setMasterVisibleCount(10);
                    }}
                    placeholder="Search by Booking ID (e.g. BK-A03C5A)..."
                    className="w-full rounded-xl border border-black/15 dark:border-white/10 bg-[#f7f8f4] dark:bg-[#0B0B0C] py-2 pl-9 pr-8 text-xs font-semibold text-[#101310] dark:text-[#F7F8F4] placeholder:text-black/40 dark:placeholder:text-[#F7F8F4]/40 outline-none focus:border-[#81971d] dark:focus:border-[#d8ff3e]"
                  />
                  {masterSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setMasterSearchQuery('');
                        setMasterVisibleCount(10);
                      }}
                      aria-label="Clear booking ID search"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-black/45 dark:text-[#F7F8F4]/50 hover:text-black dark:hover:text-[#F7F8F4]"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 text-[11px] font-bold text-black/50 dark:text-[#F7F8F4]/50">
                    Sport:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setMasterSportFilter('ALL');
                      setMasterVisibleCount(10);
                    }}
                    className={`rounded-full border px-3 py-1 text-[11px] font-black transition ${
                      masterSportFilter === 'ALL'
                        ? 'border-[#101310] dark:border-[#d8ff3e] bg-[#101310] dark:bg-[#d8ff3e] text-[#d8ff3e] dark:text-[#101310]'
                        : 'border-black/15 dark:border-white/10 bg-[#f7f8f4] dark:bg-[#0B0B0C] text-black/65 dark:text-[#F7F8F4]/75 hover:border-black/30 dark:hover:border-white/25'
                    }`}
                  >
                    All ({baseTabBookings.length})
                  </button>

                  {availableMasterSports.map((sport) => {
                    const countInTab = baseTabBookings.filter(
                      (b) => String(b.sport || '').trim().toUpperCase() === sport
                    ).length;

                    return (
                      <button
                        key={sport}
                        type="button"
                        onClick={() => {
                          setMasterSportFilter(sport);
                          setMasterVisibleCount(10);
                        }}
                        className={`rounded-full border px-3 py-1 text-[11px] font-black transition ${
                          masterSportFilter === sport
                            ? 'border-[#81971d] dark:border-[#d8ff3e] bg-[#81971d] dark:bg-[#d8ff3e] text-white dark:text-[#101310]'
                            : 'border-black/15 dark:border-white/10 bg-[#f7f8f4] dark:bg-[#0B0B0C] text-black/65 dark:text-[#F7F8F4]/75 hover:border-black/30 dark:hover:border-white/25'
                        }`}
                      >
                        {sport} ({countInTab})
                      </button>
                    );
                  })}
                </div>
              </div>

              {visibleMasterBookings.length > 0 ? (
                <div
                  className={
                    masterViewMode === 'grid'
                      ? 'mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'
                      : 'mt-6 divide-y divide-black/10 dark:divide-white/10 rounded-2xl border border-black/10 dark:border-white/10'
                  }
                >
                  {visibleMasterBookings.map((b) => (
                    <div
                      key={b.dbId || b.id}
                      className={
                        masterViewMode === 'grid'
                          ? 'flex flex-col justify-between gap-4 rounded-2xl border border-black/10 dark:border-white/10 bg-[#f7f8f4]/60 dark:bg-[#0B0B0C]/60 p-4 transition hover:border-black/25 dark:hover:border-white/25'
                          : 'flex flex-col gap-3 p-4 sm:flex-row sm:items-center justify-between'
                      }
                    >
                      <div>
                        <span className="text-[10px] font-black uppercase text-[#81971d] dark:text-[#d8ff3e]">
                          {b.sport} · Ref: <span className="font-mono">{b.id}</span>
                        </span>
                        <p className="font-extrabold text-base text-[#101310] dark:text-[#F7F8F4] mt-0.5">
                          {b.venue}{' '}
                          {(b.customerName || b.customerEmail) && (
                            <span className="text-xs font-semibold text-black/50 dark:text-[#F7F8F4]/60">
                              ({b.customerName || b.customerEmail})
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-black/50 dark:text-[#F7F8F4]/60 mt-0.5">
                          {b.date} · {b.time}
                        </p>
                      </div>

                      <div
                        className={
                          masterViewMode === 'grid'
                            ? 'flex items-center justify-between border-t border-black/10 dark:border-white/10 pt-3'
                            : 'flex items-center gap-3'
                        }
                      >
                        <span
                          className={`rounded-full px-3 py-1 text-[10px] font-black ${
                            b.status === 'Cancelled'
                              ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'
                              : 'bg-[#edf5d2] dark:bg-[#d8ff3e]/20 text-[#5d7112] dark:text-[#d8ff3e]'
                          }`}
                        >
                          {b.status}
                        </span>

                        <div className="flex items-center gap-3">
                          <b className="text-sm text-[#101310] dark:text-[#F7F8F4]">
                            {money(b.price)}
                          </b>
                          {b.status === 'Confirmed' && masterTimeTab === 'active' && (
                            <button
                              onClick={() => handleCancelReservation(b)}
                              className="text-xs font-bold text-red-600 dark:text-red-400 underline hover:text-red-800 dark:hover:text-red-300 transition"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-6 rounded-2xl border border-black/10 dark:border-white/10 p-8 text-center text-xs font-bold text-black/45 dark:text-[#F7F8F4]/50">
                  No {masterTimeTab === 'active' ? 'current or active' : 'past'}{' '}
                  reservations found matching your filters.
                </div>
              )}

              {filteredMasterBookings.length > 0 && (
                <div className="mt-6 flex flex-col items-center gap-2.5">
                  <p className="text-xs font-semibold text-black/50 dark:text-[#F7F8F4]/55">
                    Showing {visibleMasterBookings.length} of{' '}
                    {filteredMasterBookings.length} bookings
                  </p>

                  {hasMoreMasterBookings && (
                    <button
                      type="button"
                      onClick={() => setMasterVisibleCount((prev) => prev + 10)}
                      className="rounded-xl border border-black/15 dark:border-white/15 bg-[#f7f8f4] dark:bg-[#0B0B0C] px-5 py-2 text-xs font-black text-[#101310] dark:text-[#F7F8F4] transition hover:border-black/35 dark:hover:border-white/30 hover:bg-[#eef7cf] dark:hover:bg-white/10"
                    >
                      Load More
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="mt-8 rounded-3xl border border-dashed border-black/20 dark:border-white/15 bg-white dark:bg-[#16171A] p-12 text-center">
            <h2 className="text-xl font-black text-[#101310] dark:text-[#F7F8F4]">No active venue found</h2>
            <p className="mt-2 text-xs text-black/55 dark:text-[#F7F8F4]/60">
              This account is no longer linked to an active venue listing.
            </p>
          </div>
        ))}

      {activeRole === 'coach' && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
            <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#16171A] p-6 shadow-sm">
              <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-black/45 dark:text-[#F7F8F4]/50">
                <span>COACHING REVENUE</span>
                <DollarSign size={18} className="text-[#81971d] dark:text-[#d8ff3e]" />
              </div>
              <p className="mt-2 text-3xl font-black text-[#101310] dark:text-[#F7F8F4]">{money(0)}</p>
            </div>

            <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#16171A] p-6 shadow-sm">
              <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-black/45 dark:text-[#F7F8F4]/50">
                <span>CLIENT SESSIONS</span>
                <CheckCircle2 size={18} className="text-green-600 dark:text-green-400" />
              </div>
              <p className="mt-2 text-3xl font-black text-[#101310] dark:text-[#F7F8F4]">0</p>
            </div>

            <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#16171A] p-6 shadow-sm">
              <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-black/45 dark:text-[#F7F8F4]/50">
                <span>CANCELLATIONS</span>
                <XCircle size={18} className="text-red-500 dark:text-red-400" />
              </div>
              <p className="mt-2 text-3xl font-black text-[#101310] dark:text-[#F7F8F4]">0</p>
            </div>
          </div>

          <div className="mt-8 rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#16171A] p-6 sm:p-8 shadow-sm">
            <h2 className="text-2xl font-black tracking-tight text-[#101310] dark:text-[#F7F8F4]">
              Coaching Sessions
            </h2>
            <p className="mt-1 text-xs text-black/50 dark:text-[#F7F8F4]/60">
              Your upcoming and past player coaching sessions.
            </p>
            <div className="mt-6 rounded-2xl border border-black/10 dark:border-white/10 p-8 text-center text-xs font-bold text-black/45 dark:text-[#F7F8F4]/50">
              No coaching sessions booked yet.
            </div>
          </div>
        </>
      )}
    </section>
  );
}