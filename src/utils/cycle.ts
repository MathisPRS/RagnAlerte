import type { Cycle, CycleInfo, CyclePhase } from '../types';

const DEFAULT_CYCLE_LENGTH = 28;
const DEFAULT_PERIOD_DURATION = 5;
const OVULATION_OFFSET = 14; // days before next period

export interface NoPeriodMode {
  enabled: boolean;
  referenceDate: string | null; // YYYY-MM-DD
}

/**
 * computeCycleInfo
 * When noPeriodMode is enabled and there are no real cycles, uses the referenceDate
 * as a virtual cycle start date (theoretical 28-day cycle). The resulting CycleInfo
 * is identical to a real cycle except:
 *   - the `phase` field can be 'menstrual' (theoretical, shown differently by UI)
 *   - a `isTheoretical` flag is added to distinguish it
 */
export function computeCycleInfo(
  cycles: Cycle[],
  today: Date = new Date(),
  noPeriodMode?: NoPeriodMode
): CycleInfo {
  const todayClean = new Date(today);
  todayClean.setHours(0, 0, 0, 0);

  // No-period mode: synthesize a virtual cycle from referenceDate when no real cycles exist
  if (!cycles.length && noPeriodMode?.enabled && noPeriodMode.referenceDate) {
    const virtualStart = parseDate(noPeriodMode.referenceDate);
    virtualStart.setHours(0, 0, 0, 0);
    // Build a synthetic Cycle object and recurse (without noPeriodMode to avoid infinite loop)
    const virtualCycle: Cycle = {
      id: -1,
      user_id: -1,
      start_date: noPeriodMode.referenceDate,
      end_date: null,
      cycle_length: null,
      notes: null,
    };
    return computeCycleInfo([virtualCycle], today);
  }

  if (!cycles.length) {
    return {
      phase: 'follicular',
      dayInCycle: 1,
      totalCycleLength: DEFAULT_CYCLE_LENGTH,
      nextPeriodDate: null,
      daysUntilNextPeriod: null,
      isLate: false,
      daysLate: 0,
      ovulationDate: null,
      daysUntilOvulation: null,
      fertilityWindowStart: null,
      fertilityWindowEnd: null,
      isInFertileWindow: false,
      avgPeriodDuration: DEFAULT_PERIOD_DURATION,
      currentPeriodStart: null,
      periodDayNumber: null,
    };
  }

  // Average cycle length from last 6 recorded cycle lengths
  const recentLengths = cycles
    .slice(0, 6)
    .map((c) => c.cycle_length)
    .filter((l): l is number => l !== null && l > 14 && l < 50);

  const avgCycleLength =
    recentLengths.length > 0
      ? Math.round(recentLengths.reduce((a, b) => a + b, 0) / recentLengths.length)
      : DEFAULT_CYCLE_LENGTH;

  // Average period duration from cycles that have both start + end
  const periodDurations = cycles
    .slice(0, 6)
    .filter((c) => c.end_date != null)
    .map((c) => {
      const s = new Date(c.start_date);
      const e = new Date(c.end_date!);
      s.setHours(0, 0, 0, 0);
      e.setHours(0, 0, 0, 0);
      return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    })
    .filter((d) => d > 0 && d <= 10);

  const avgPeriodDuration =
    periodDurations.length > 0
      ? Math.round(periodDurations.reduce((a, b) => a + b, 0) / periodDurations.length)
      : DEFAULT_PERIOD_DURATION;

  const lastCycle = cycles[0];
  const lastStart = new Date(lastCycle.start_date);
  lastStart.setHours(0, 0, 0, 0);

  const dayInCycle =
    Math.floor((todayClean.getTime() - lastStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // Next period
  const nextPeriodDate = new Date(lastStart);
  nextPeriodDate.setDate(nextPeriodDate.getDate() + avgCycleLength);

  const daysUntilNextPeriod = Math.round(
    (nextPeriodDate.getTime() - todayClean.getTime()) / (1000 * 60 * 60 * 24)
  );

  const isLate = daysUntilNextPeriod < 0 && dayInCycle > avgPeriodDuration;
  const daysLate = isLate ? Math.abs(daysUntilNextPeriod) : 0;

  // Ovulation
  const ovulationDate = new Date(nextPeriodDate);
  ovulationDate.setDate(ovulationDate.getDate() - OVULATION_OFFSET);

  const daysUntilOvulation = Math.round(
    (ovulationDate.getTime() - todayClean.getTime()) / (1000 * 60 * 60 * 24)
  );

  const fertilityWindowStart = new Date(ovulationDate);
  fertilityWindowStart.setDate(fertilityWindowStart.getDate() - 5);

  const fertilityWindowEnd = new Date(ovulationDate);
  fertilityWindowEnd.setDate(fertilityWindowEnd.getDate() + 1);

  const isInFertileWindow =
    todayClean >= fertilityWindowStart && todayClean <= fertilityWindowEnd;

  // Current period detection
  const lastEnd = lastCycle.end_date ? new Date(lastCycle.end_date) : null;
  if (lastEnd) lastEnd.setHours(0, 0, 0, 0);

  const inCurrentPeriod =
    dayInCycle >= 1 &&
    (lastEnd
      ? todayClean <= lastEnd
      : dayInCycle <= avgPeriodDuration);

  const currentPeriodStart = inCurrentPeriod ? lastStart : null;
  const periodDayNumber = inCurrentPeriod ? dayInCycle : null;

  // Determine phase
  const ovulationDay = avgCycleLength - OVULATION_OFFSET;
  const fertilityStart = ovulationDay - 5;
  const fertilityEnd = ovulationDay + 1;

  let phase: CyclePhase;
  if (dayInCycle >= 1 && dayInCycle <= avgPeriodDuration) {
    phase = 'menstrual';
  } else if (dayInCycle > avgPeriodDuration && dayInCycle < fertilityStart) {
    phase = 'follicular';
  } else if (dayInCycle >= fertilityStart && dayInCycle <= fertilityEnd) {
    phase = 'ovulation';
  } else {
    phase = 'luteal';
  }

  return {
    phase,
    dayInCycle: Math.max(1, dayInCycle),
    totalCycleLength: avgCycleLength,
    nextPeriodDate,
    daysUntilNextPeriod,
    isLate,
    daysLate,
    ovulationDate,
    daysUntilOvulation,
    fertilityWindowStart,
    fertilityWindowEnd,
    isInFertileWindow,
    avgPeriodDuration,
    currentPeriodStart,
    periodDayNumber,
  };
}

export function getPhaseLabel(phase: CyclePhase): string {
  switch (phase) {
    case 'menstrual': return 'Phase Menstruelle';
    case 'follicular': return 'Phase Folliculaire';
    case 'ovulation': return 'Phase d\'Ovulation';
    case 'luteal': return 'Phase Lutéale';
  }
}

export function getPhaseAdvice(phase: CyclePhase): string {
  switch (phase) {
    case 'menstrual':
      return 'Votre corps se renouvelle. Privilégiez le repos, des boissons chaudes et des étirements doux pour soulager les crampes.';
    case 'follicular':
      return 'Votre énergie remonte progressivement. C\'est le bon moment pour commencer de nouveaux projets et activités.';
    case 'ovulation':
      return 'Vous êtes dans votre fenêtre de fertilité maximale. Votre énergie et votre confiance sont à leur sommet.';
    case 'luteal':
      return 'Pendant cette phase, votre énergie peut fluctuer. Privilégiez des étirements doux pour soulager le bas du dos.';
  }
}

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDisplayDate(dateStr: string): string {
  const d = parseDate(dateStr);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function getDayLabel(dayOfWeek: number): string {
  const days = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  return days[dayOfWeek];
}

export function getDayShortLabel(dayOfWeek: number): string {
  const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  return days[dayOfWeek];
}

export function getWeekDays(today: Date): Date[] {
  const days: Date[] = [];
  // Show today ± 3 days
  for (let i = -3; i <= 3; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function getFirstDayOfMonth(year: number, month: number): number {
  // Returns 0-6, where 0 = Monday (ISO week)
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

/**
 * Calendar phase type — for coloring every day by its cycle phase.
 * 'menstrual_theoretical' is used in no-period mode for the theoretical bleed window.
 */
export type CalendarPhase =
  | 'menstrual'
  | 'menstrual_theoretical'
  | 'follicular'
  | 'ovulation'
  | 'luteal'
  | 'predicted'
  | 'none';

/**
 * Returns the phase for a given calendar day based on cycle history.
 * Works for past AND future days within the current computed cycle.
 *
 * @param dateStr      YYYY-MM-DD
 * @param cycles       sorted DESC list of cycles from db
 * @param cycleInfo    precomputed CycleInfo (computed from today)
 * @param noPeriodMode optional no-period mode config
 */
export function getDayPhaseForCalendar(
  dateStr: string,
  cycles: Cycle[],
  cycleInfo: CycleInfo | null,
  noPeriodMode?: NoPeriodMode
): CalendarPhase {
  if (!cycleInfo) return 'none';

  const todayStr = formatDate(new Date());

  // ── 1. Check against real recorded period cycles ───────────────────────────
  for (const c of cycles) {
    const inRange = c.end_date
      ? dateStr >= c.start_date && dateStr <= c.end_date
      : dateStr === c.start_date;
    if (inRange) return 'menstrual';
  }

  // ── 2. Predicted next menstrual window (future) ────────────────────────────
  if (cycleInfo.nextPeriodDate) {
    const nextStr = formatDate(cycleInfo.nextPeriodDate);
    const endNext = new Date(cycleInfo.nextPeriodDate);
    endNext.setDate(endNext.getDate() + cycleInfo.avgPeriodDuration - 1);
    const endNextStr = formatDate(endNext);
    if (dateStr >= nextStr && dateStr <= endNextStr && dateStr > todayStr) {
      return noPeriodMode?.enabled ? 'menstrual_theoretical' : 'predicted';
    }
  }

  // ── 3. Map current cycle days (from last cycle start) to phases ────────────
  //    We derive a virtual "day in cycle" for any dateStr relative to the last start.
  const lastCycle = cycles[0];
  if (!lastCycle) return 'none';

  const lastStart = parseDate(lastCycle.start_date);
  lastStart.setHours(0, 0, 0, 0);
  const targetDate = parseDate(dateStr);
  targetDate.setHours(0, 0, 0, 0);

  const dayNum =
    Math.floor((targetDate.getTime() - lastStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // Only apply phase coloring within the current expected cycle range
  if (dayNum < 1 || dayNum > cycleInfo.totalCycleLength + 7) return 'none';

  const avgPeriodDuration = cycleInfo.avgPeriodDuration;
  const ovulationDay = cycleInfo.totalCycleLength - OVULATION_OFFSET;
  const fertilityStart = ovulationDay - 5;
  const fertilityEnd = ovulationDay + 1;

  if (dayNum >= 1 && dayNum <= avgPeriodDuration) {
    // In no-period mode, the cycle was synthesized from a referenceDate — show as theoretical
    return noPeriodMode?.enabled ? 'menstrual_theoretical' : 'menstrual';
  } else if (dayNum > avgPeriodDuration && dayNum < fertilityStart) {
    return 'follicular';
  } else if (dayNum >= fertilityStart && dayNum <= fertilityEnd) {
    return 'ovulation';
  } else if (dayNum > fertilityEnd && dayNum <= cycleInfo.totalCycleLength) {
    return 'luteal';
  }

  return 'none';
}
