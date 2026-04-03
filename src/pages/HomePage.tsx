import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getCycles, getSymptomsForDate, getNoPeriodMode } from '../services/db';
import { computeCycleInfo, formatDate, getPhaseAdvice, getWeekDays, isSameDay, getDayLabel } from '../utils/cycle';
import type { NoPeriodMode } from '../utils/cycle';
import type { Cycle, CycleInfo } from '../types';

const SYMPTOM_DISPLAY: Record<string, { icon: string; label: string }> = {
  crampes: { icon: 'waves', label: 'Crampes' },
  ballonnement: { icon: 'air', label: 'Ballonnement' },
  maux_tete: { icon: 'psychology', label: 'Maux de tête' },
  saignement: { icon: 'water_drop', label: 'Saignement' },
  insomnie: { icon: 'dark_mode', label: 'Insomnie' },
  vertiges: { icon: 'cyclone', label: 'Vertiges' },
  nausee: { icon: 'sick', label: 'Nausée' },
  acne: { icon: 'face', label: 'Acné' },
  fringale: { icon: 'restaurant', label: 'Fringale' },
  fatigue: { icon: 'battery_very_low', label: 'Fatigue' },
  seins_sensibles: { icon: 'favorite', label: 'Seins sensibles' },
  saignement_leger: { icon: 'water_drop', label: 'Flux léger' },
  saignement_moyen: { icon: 'water_drop', label: 'Flux moyen' },
  saignement_abondant: { icon: 'water_drop', label: 'Flux abondant' },
};

// ── helpers ──────────────────────────────────────────────────────────────────

function getOrbStyle(info: CycleInfo, hasCycles: boolean, isTheoretical: boolean): {
  phaseLabel: string;
  phaseColor: string;
  orbGlow: string;
  progressColor: string;
  dayLabel: string;
  isAlert: boolean;
} {
  if (!hasCycles) {
    return {
      phaseLabel: 'Commencer',
      phaseColor: 'text-on-surface',
      orbGlow: 'rgba(161,59,87,0.06)',
      progressColor: '#a13b57',
      dayLabel: 'Enregistrez vos premières règles',
      isAlert: false,
    };
  }

  if (info.isLate) {
    return {
      phaseLabel: `Retard · ${info.daysLate}j`,
      phaseColor: 'text-error',
      orbGlow: 'rgba(172,52,52,0.08)',
      progressColor: '#ac3434',
      dayLabel: info.daysLate <= 3 ? 'Léger retard' : info.daysLate <= 7 ? 'Peut-être du stress ?' : 'Consultez si besoin',
      isAlert: true,
    };
  }

  const cycleDay = `Jour ${info.dayInCycle} · Cycle ${info.totalCycleLength}j`;

  switch (info.phase) {
    case 'menstrual':
      return {
        phaseLabel: isTheoretical ? 'Règles théoriques' : 'Phase Menstruelle',
        phaseColor: 'text-primary',
        orbGlow: 'rgba(161,59,87,0.12)',
        progressColor: '#a13b57',
        dayLabel: cycleDay,
        isAlert: false,
      };
    case 'follicular':
      return {
        phaseLabel: 'Phase Folliculaire',
        phaseColor: 'text-[#5b8c5a]',
        orbGlow: 'rgba(91,140,90,0.08)',
        progressColor: '#5b8c5a',
        dayLabel: cycleDay,
        isAlert: false,
      };
    case 'ovulation':
      return {
        phaseLabel: 'Phase d\'Ovulation',
        phaseColor: 'text-secondary',
        orbGlow: 'rgba(115,85,120,0.12)',
        progressColor: '#735578',
        dayLabel: cycleDay,
        isAlert: false,
      };
    case 'luteal':
      return {
        phaseLabel: 'Phase Lutéale',
        phaseColor: 'text-tertiary',
        orbGlow: 'rgba(96,92,120,0.08)',
        progressColor: '#605c78',
        dayLabel: cycleDay,
        isAlert: false,
      };
  }
}

// ── component ─────────────────────────────────────────────────────────────────

export function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [cycleInfo, setCycleInfo] = useState<CycleInfo | null>(null);
  const [noPeriodMode, setNoPeriodModeState] = useState<NoPeriodMode>({ enabled: false, referenceDate: null });
  const [todaySymptoms, setTodaySymptoms] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const today = new Date();
  const todayStr = formatDate(today);
  const weekDays = getWeekDays(today);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const npm = getNoPeriodMode(user.id);
      setNoPeriodModeState(npm);
      const c = await getCycles(user.id);
      setCycles(c);
      setCycleInfo(computeCycleInfo(c, new Date(), npm));

      const sym = await getSymptomsForDate(user.id, todayStr);
      setTodaySymptoms(sym);
      setIsLoading(false);
    };
    load();
  }, [user, todayStr]);

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-surface">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const hasCycles = cycles.length > 0 || (noPeriodMode.enabled && !!noPeriodMode.referenceDate);
  const isTheoretical = noPeriodMode.enabled && cycles.length === 0;
  const orb = cycleInfo ? getOrbStyle(cycleInfo, hasCycles, isTheoretical) : null;
  const progress = cycleInfo
    ? Math.min(100, Math.max(0, ((cycleInfo.dayInCycle - 1) / cycleInfo.totalCycleLength) * 100))
    : 0;

  return (
    <div className="bg-surface min-h-full">
      {/* TopAppBar */}
      <header className="sticky top-0 z-40 w-full bg-surface-container-low/80 backdrop-blur-xl flex justify-between items-center px-6 py-4">
        <h1 className="font-headline font-bold text-2xl tracking-tight text-primary">RagnAlerte</h1>
        <div className="w-9 h-9 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center">
          <span className="font-headline font-bold text-primary text-sm">
            {user?.name.charAt(0).toUpperCase()}
          </span>
        </div>
      </header>

      <main className="px-5">
        {/* Linear week calendar */}
        <section className="mt-4 mb-5">
          <div className="flex justify-between items-center bg-surface-container-lowest p-3 rounded-[1.5rem] shadow-[0_4px_20px_rgba(46,51,53,0.04)]">
            {weekDays.map((day) => {
              const isToday = isSameDay(day, today);
              const dayStr = formatDate(day);
              const isMenstrual =
                cycles.length > 0 &&
                dayStr >= cycles[0].start_date &&
                (!cycles[0].end_date || dayStr <= cycles[0].end_date);

              return (
                <div
                  key={dayStr}
                  className={`flex flex-col items-center px-2 py-1.5 rounded-full ${isToday ? 'bg-primary/10' : ''}`}
                >
                  <span className={`font-label text-[10px] font-bold uppercase ${isToday ? 'text-primary' : 'text-on-surface-variant'}`}>
                    {getDayLabel(day.getDay())}
                  </span>
                  <span className={`font-bold text-sm mt-0.5 ${isToday ? 'text-primary' : 'text-on-surface'}`}>
                    {day.getDate()}
                  </span>
                  {isMenstrual && (
                    <div className="w-1.5 h-1.5 bg-primary rounded-full mt-0.5" />
                  )}
                  {!isMenstrual && cycleInfo?.isInFertileWindow &&
                    cycleInfo.fertilityWindowStart && cycleInfo.fertilityWindowEnd &&
                    dayStr >= formatDate(cycleInfo.fertilityWindowStart) &&
                    dayStr <= formatDate(cycleInfo.fertilityWindowEnd) && (
                    <div className="w-1.5 h-1.5 bg-secondary rounded-full mt-0.5" />
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Cycle Orb ────────────────────────────────────────────────────── */}
        <section className="flex flex-col items-center py-6 relative mb-2">
          {/* Ambient glow */}
          <div
            className="absolute -z-10 w-64 h-64 rounded-full blur-3xl"
            style={{ background: orb?.orbGlow ?? 'rgba(161,59,87,0.06)' }}
          />

          {/* Orb circle */}
          <div className="relative w-60 h-60">
            {/* SVG progress ring */}
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 240 240">
              {/* Track */}
              <circle cx="120" cy="120" r="108" fill="none" stroke="#ebeef0" strokeWidth="6" />
              {/* Progress */}
              <circle
                cx="120" cy="120" r="108"
                fill="none"
                stroke={orb?.progressColor ?? '#a13b57'}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 108}`}
                strokeDashoffset={`${2 * Math.PI * 108 * (1 - progress / 100)}`}
                style={{ transition: 'stroke-dashoffset 0.8s ease' }}
              />
            </svg>

            {/* Inner card */}
            <div className="absolute inset-3 rounded-full bg-surface-container-lowest shadow-[0_0_40px_rgba(46,51,53,0.06)] flex flex-col items-center justify-center text-center px-4 gap-1">
              {/* Phase name */}
              <p className={`font-headline font-extrabold text-xl leading-tight ${orb?.phaseColor ?? 'text-on-surface'} ${isTheoretical && cycleInfo?.phase === 'menstrual' ? 'italic' : ''}`}>
                {orb?.phaseLabel ?? '—'}
              </p>

              {/* Day label */}
              <p className="text-on-surface-variant text-[11px] font-medium leading-tight">
                {orb?.dayLabel}
              </p>

              {/* Divider */}
              {hasCycles && (
                <div className="w-8 h-px bg-outline-variant/40 my-1" />
              )}

              {/* CTA button */}
              <button
                onClick={() => navigate('/enregistrer-regles')}
                className="bg-primary/10 text-primary font-headline font-bold px-4 py-1.5 rounded-full text-[11px] hover:bg-primary/20 active:scale-95 transition-all"
              >
                Renseigner le cycle
              </button>
            </div>
          </div>

        </section>

        {/* ── Cycle timeline chips ─────────────────────────────────────────── */}
        {cycleInfo && hasCycles && (
          <section className="mb-5">
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {/* Règles */}
              <CycleChip
                icon="water_drop"
                label={cycleInfo.phase === 'menstrual'
                  ? `Règles · J${cycleInfo.periodDayNumber ?? cycleInfo.dayInCycle}`
                  : cycleInfo.isLate
                  ? `Retard ${cycleInfo.daysLate}j`
                  : cycleInfo.daysUntilNextPeriod === 0
                  ? "Règles aujourd'hui"
                  : cycleInfo.daysUntilNextPeriod === 1
                  ? 'Règles demain'
                  : `Règles dans ${cycleInfo.daysUntilNextPeriod}j`
                }
                active={cycleInfo.phase === 'menstrual' || cycleInfo.isLate}
                alert={cycleInfo.isLate}
                color="primary"
              />

              {/* Ovulation */}
              <CycleChip
                icon="favorite"
                label={cycleInfo.daysUntilOvulation === 0
                  ? "Ovulation auj."
                  : cycleInfo.daysUntilOvulation !== null && cycleInfo.daysUntilOvulation > 0
                  ? `Ovulation dans ${cycleInfo.daysUntilOvulation}j`
                  : 'Ovulation passée'
                }
                active={cycleInfo.daysUntilOvulation === 0}
                color="secondary"
              />

              {/* Fenêtre fertile */}
              <CycleChip
                icon="spa"
                label={cycleInfo.isInFertileWindow ? 'Fenêtre fertile' : 'Hors fertilité'}
                active={cycleInfo.isInFertileWindow}
                color="secondary"
              />

              {/* Phase */}
              <CycleChip
                icon={
                  cycleInfo.phase === 'menstrual' ? 'water_drop'
                  : cycleInfo.phase === 'follicular' ? 'eco'
                  : cycleInfo.phase === 'ovulation' ? 'flare'
                  : 'nights_stay'
                }
                label={
                  cycleInfo.phase === 'menstrual' ? 'Menstruelle'
                  : cycleInfo.phase === 'follicular' ? 'Folliculaire'
                  : cycleInfo.phase === 'ovulation' ? 'Ovulation'
                  : 'Lutéale'
                }
                active={false}
                color="tertiary"
              />
            </div>
          </section>
        )}

        {/* ── Action cards ─────────────────────────────────────────────────── */}
        <section className="space-y-4 pb-4">
          {/* Note les symptômes */}
          <button
            onClick={() => navigate('/notes')}
            className="w-full bg-surface-container-lowest rounded-[1.5rem] p-5 shadow-[0_4px_20px_rgba(46,51,53,0.04)] flex items-center justify-between group hover:shadow-[0_4px_20px_rgba(161,59,87,0.08)] transition-all active:scale-[0.98]"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-2xl">add_circle</span>
              </div>
              <div className="text-left">
                <h3 className="font-headline font-bold text-base text-on-surface">Noter les symptômes</h3>
                <p className="text-on-surface-variant text-xs">Suivez vos changements physiques</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant group-hover:translate-x-1 transition-transform">chevron_right</span>
          </button>

          {/* Symptoms today */}
          {todaySymptoms.length > 0 && (
            <div className="bg-surface-container-lowest rounded-[1.5rem] p-5 shadow-[0_4px_20px_rgba(46,51,53,0.04)]">
              <h3 className="font-headline font-bold text-sm text-on-surface mb-3">Symptômes du jour</h3>
              <div className="flex flex-wrap gap-2">
                {todaySymptoms.map((s) => (
                  <span
                    key={s}
                    className="flex items-center gap-1.5 bg-primary/8 text-primary text-xs font-bold px-3 py-1.5 rounded-full"
                  >
                    <span className="material-symbols-outlined text-sm">{SYMPTOM_DISPLAY[s]?.icon ?? 'circle'}</span>
                    {SYMPTOM_DISPLAY[s]?.label ?? s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Educational tip */}
          {cycleInfo && (
            <div className="bg-secondary-container/20 rounded-[1.5rem] p-5 flex gap-4">
              <div className="text-secondary shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-xl">lightbulb</span>
              </div>
              <div>
                <h4 className="font-headline font-bold text-sm text-on-secondary-container">Conseil bien-être</h4>
                <p className="text-on-secondary-container/80 text-xs mt-1 leading-relaxed">
                  {getPhaseAdvice(cycleInfo.phase)}
                </p>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

// ── CycleChip sub-component ───────────────────────────────────────────────────

function CycleChip({
  icon, label, active, alert = false, color,
}: {
  icon: string;
  label: string;
  active: boolean;
  alert?: boolean;
  color: 'primary' | 'secondary' | 'tertiary';
}) {
  const colorMap = {
    primary: {
      active: 'bg-primary text-on-primary shadow-[0_4px_14px_rgba(161,59,87,0.25)]',
      inactive: 'bg-surface-container text-on-surface-variant',
      alert: 'bg-error text-on-error shadow-[0_4px_14px_rgba(172,52,52,0.2)]',
    },
    secondary: {
      active: 'bg-secondary text-on-secondary shadow-[0_4px_14px_rgba(115,85,120,0.25)]',
      inactive: 'bg-surface-container text-on-surface-variant',
      alert: 'bg-error text-on-error',
    },
    tertiary: {
      active: 'bg-tertiary text-on-tertiary shadow-md',
      inactive: 'bg-surface-container text-on-surface-variant',
      alert: 'bg-error text-on-error',
    },
  };

  const cls = alert
    ? colorMap[color].alert
    : active
    ? colorMap[color].active
    : colorMap[color].inactive;

  return (
    <div className={`flex items-center gap-1.5 px-3 py-2 rounded-full shrink-0 transition-all ${cls}`}>
      <span className={`material-symbols-outlined text-sm ${active ? 'icon-fill' : ''}`}>{icon}</span>
      <span className="text-xs font-bold whitespace-nowrap">{label}</span>
    </div>
  );
}
