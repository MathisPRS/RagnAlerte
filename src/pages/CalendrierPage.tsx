import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getCycles, getDailyLog, getSymptomsForDate, getDaysWithDataForMonth, getNoPeriodMode } from '../services/db';
import { computeCycleInfo, formatDate, getDaysInMonth, getFirstDayOfMonth, parseDate, getDayPhaseForCalendar } from '../utils/cycle';
import type { NoPeriodMode } from '../utils/cycle';
import type { Cycle, CycleInfo } from '../types';

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const SYMPTOM_ICONS: Record<string, string> = {
  crampes: 'waves', ballonnement: 'air', maux_tete: 'psychology',
  saignement: 'water_drop', insomnie: 'dark_mode', vertiges: 'cyclone',
  nausee: 'sick', acne: 'face', fringale: 'restaurant',
  fatigue: 'battery_very_low', seins_sensibles: 'favorite',
  saignement_leger: 'water_drop', saignement_moyen: 'water_drop', saignement_abondant: 'water_drop',
};

const SYMPTOM_LABELS: Record<string, string> = {
  crampes: 'Crampes', ballonnement: 'Ballonnement', maux_tete: 'Maux de tête',
  saignement: 'Saignement', insomnie: 'Insomnie', vertiges: 'Vertiges',
  nausee: 'Nausée', acne: 'Acné', fringale: 'Fringale',
  fatigue: 'Fatigue', seins_sensibles: 'Seins sensibles',
  saignement_leger: 'Flux léger', saignement_moyen: 'Flux moyen', saignement_abondant: 'Flux abondant',
};

export function CalendrierPage() {
  const { user } = useAuth();
  const today = new Date();

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [cycleInfo, setCycleInfo] = useState<CycleInfo | null>(null);
  const [noPeriodMode, setNoPeriodModeState] = useState<NoPeriodMode>({ enabled: false, referenceDate: null });
  const [selectedDate, setSelectedDate] = useState<string>(formatDate(today));
  const [selectedLog, setSelectedLog] = useState<{ mood: number | null; libido: number | null; notes: string | null } | null>(null);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [daysWithData, setDaysWithData] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    const npm = getNoPeriodMode(user.id);
    setNoPeriodModeState(npm);
    getCycles(user.id).then((c) => {
      setCycles(c);
      setCycleInfo(computeCycleInfo(c, new Date(), npm));
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    getDaysWithDataForMonth(user.id, viewYear, viewMonth).then(setDaysWithData);
  }, [user, viewYear, viewMonth]);

  useEffect(() => {
    if (!user || !selectedDate) return;
    getDailyLog(user.id, selectedDate).then(setSelectedLog);
    getSymptomsForDate(user.id, selectedDate).then(setSelectedSymptoms);
  }, [user, selectedDate]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(v => v - 1); }
    else setViewMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(v => v + 1); }
    else setViewMonth(m => m + 1);
  };

  const getDayType = (dateStr: string) => {
    return getDayPhaseForCalendar(dateStr, cycles, cycleInfo, noPeriodMode);
  };

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const todayStr = formatDate(today);

  // Map CalendarPhase → Tailwind classes for the day cell
  // menstrual_theoretical gets no border class here — handled via inline style below
  const phaseClasses: Record<string, string> = {
    menstrual:             'bg-primary/15 text-primary',
    menstrual_theoretical: 'bg-primary/8 text-primary/80',
    follicular:            'bg-[#e8f5e9] text-[#3a6b39]',
    ovulation:             'bg-[#ffd6a5] text-[#8b4513]',
    luteal:                'bg-[#ede7f6] text-[#5e35b1]',
    predicted:             'bg-primary/8 text-primary/70',
    none:                  '',
  };

  const selectedDateDisplay = selectedDate
    ? parseDate(selectedDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    : '';

  return (
    <div className="bg-surface min-h-full">
      {/* TopAppBar */}
      <header className="sticky top-0 z-40 bg-surface-container-low/80 backdrop-blur-xl flex justify-between items-center px-6 py-4">
        <div className="flex flex-col">
          <h1 className="font-headline text-2xl font-bold tracking-tight text-on-surface">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </h1>
          <p className="text-on-surface-variant font-medium text-sm">
            {cycleInfo ? `${MONTH_NAMES[viewMonth].slice(0, 3)} · ${cycleInfo.phase === 'menstrual' ? 'Règles' : cycleInfo.phase === 'follicular' ? 'Phase Folliculaire' : cycleInfo.phase === 'ovulation' ? 'Ovulation' : 'Phase Lutéale'}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={prevMonth}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-surface-container hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-on-surface-variant">chevron_left</span>
          </button>
          <button
            onClick={nextMonth}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-surface-container hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
          </button>
        </div>
      </header>

      <main className="px-4 pt-4 pb-4">
        {/* Calendar grid */}
        <section className="bg-surface-container-low rounded-[1.75rem] p-5 mb-6">
          <div className="grid grid-cols-7 mb-3">
            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
              <div key={d} className="text-center text-[9px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-1">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="h-11" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const phase = getDayType(dateStr);
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;
              const hasData = daysWithData.has(dateStr);
              const isPast = dateStr < todayStr;
              const isTheoretical = phase === 'menstrual_theoretical';

              const baseClass = phaseClasses[phase] ?? '';
              const defaultClass = isPast ? 'text-on-surface-variant' : 'text-on-surface hover:bg-surface-container';

              // Ring classes: selected takes priority, then today
              const ringClass = isSelected
                ? 'ring-2 ring-primary ring-offset-1'
                : isToday
                ? 'ring-2 ring-on-surface ring-offset-1'
                : '';

              return (
                <div
                  key={day}
                  onClick={() => setSelectedDate(dateStr)}
                  className="h-11 flex flex-col items-center justify-center cursor-pointer"
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all active:scale-90 ${ringClass} ${baseClass || defaultClass}`}
                    style={isTheoretical ? { outline: '1.5px dashed rgba(161,59,87,0.5)', outlineOffset: '-1.5px' } : undefined}
                  >
                    {day}
                  </div>
                  {/* Dot uniquement si notes/symptômes enregistrés */}
                  <div className="h-1.5 mt-0.5 flex items-center justify-center">
                    {hasData && <div className="w-1.5 h-1.5 rounded-full bg-tertiary" />}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2.5 px-1">
            <div className="flex items-center gap-2.5">
              <span className="w-4 h-4 rounded-full bg-primary/15 shrink-0" />
              <span className="text-xs font-semibold text-on-surface-variant">Règles</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-4 h-4 rounded-full bg-[#e8f5e9] shrink-0" />
              <span className="text-xs font-semibold text-on-surface-variant">Phase Folliculaire</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-4 h-4 rounded-full bg-[#ffd6a5] shrink-0" />
              <span className="text-xs font-semibold text-on-surface-variant">Ovulation</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-4 h-4 rounded-full bg-[#ede7f6] shrink-0" />
              <span className="text-xs font-semibold text-on-surface-variant">Phase Lutéale</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span
                className="w-4 h-4 rounded-full bg-primary/8 shrink-0"
                style={{ outline: '1.5px dashed rgba(161,59,87,0.5)', outlineOffset: '-1.5px' }}
              />
              <span className="text-xs font-semibold text-on-surface-variant">Règles théoriques</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-4 h-4 rounded-full bg-tertiary shrink-0" />
              <span className="text-xs font-semibold text-on-surface-variant">Notes enregistrées</span>
            </div>
          </div>
        </section>

        {/* Day details */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-headline text-lg font-bold text-on-surface">Détails du jour</h3>
            <span className="text-xs font-medium text-primary capitalize">{selectedDateDisplay}</span>
          </div>

          {selectedLog || selectedSymptoms.length > 0 ? (
            <div className="space-y-3">
                  {selectedSymptoms.length > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                      {selectedSymptoms.map((s) => (
                    <div key={s} className="bg-surface-container-lowest p-4 rounded-[1.25rem] shadow-[0_4px_20px_rgba(46,51,53,0.04)] flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-primary text-sm">{SYMPTOM_ICONS[s] ?? 'circle'}</span>
                      </div>
                      <span className="text-xs font-bold text-on-surface">{SYMPTOM_LABELS[s] ?? s}</span>
                    </div>
                  ))}
                </div>
              )}

              {selectedLog && (
                <>
                  {(selectedLog.mood !== null || selectedLog.libido !== null) && (
                    <div className="grid grid-cols-2 gap-3">
                      {selectedLog.mood !== null && (
                        <div className="bg-surface-container-lowest p-4 rounded-[1.25rem] shadow-[0_4px_20px_rgba(46,51,53,0.04)]">
                          <div className="w-8 h-8 rounded-full bg-tertiary-container/30 flex items-center justify-center mb-2">
                            <span className="material-symbols-outlined text-tertiary text-sm">mood</span>
                          </div>
                          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Humeur</p>
                          <p className="text-sm font-semibold text-on-surface">{selectedLog.mood}%</p>
                        </div>
                      )}
                      {selectedLog.libido !== null && (
                        <div className="bg-surface-container-lowest p-4 rounded-[1.25rem] shadow-[0_4px_20px_rgba(46,51,53,0.04)]">
                          <div className="w-8 h-8 rounded-full bg-secondary-container/40 flex items-center justify-center mb-2">
                            <span className="material-symbols-outlined text-secondary text-sm icon-fill">favorite</span>
                          </div>
                          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Libido</p>
                          <p className="text-sm font-semibold text-on-surface">{selectedLog.libido}%</p>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedLog.notes && (
                    <div className="bg-primary-container/15 p-5 rounded-[1.25rem] relative overflow-hidden">
                      <p className="text-[10px] font-bold text-on-primary-container uppercase tracking-wider mb-2">Note personnelle</p>
                      <p className="text-sm font-medium text-on-primary-container leading-relaxed italic">
                        "{selectedLog.notes}"
                      </p>
                      <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-primary/5 rounded-full blur-2xl" />
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="bg-surface-container-lowest rounded-[1.25rem] p-6 text-center">
              <span className="material-symbols-outlined text-outline-variant text-3xl">event_note</span>
              <p className="text-on-surface-variant text-sm mt-2">Aucune donnée pour ce jour</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
