import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { saveCycle, getCycles, endCurrentCycle, saveCycleFromDays } from '../services/db';
import { formatDate, getDaysInMonth, getFirstDayOfMonth, parseDate } from '../utils/cycle';
import type { Cycle } from '../types';

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

// Build the full set of dates covered by a cycle (start → end inclusive)
function cycleToDays(cycle: Cycle): Set<string> {
  const days = new Set<string>();
  if (!cycle.end_date) {
    days.add(cycle.start_date);
    return days;
  }
  const s = parseDate(cycle.start_date);
  const e = parseDate(cycle.end_date);
  const cur = new Date(s);
  while (cur <= e) {
    days.add(formatDate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

export function EnregistrerReglesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = new Date();
  const todayStr = formatDate(today);

  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // mode: 'view' | 'edit'
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  // Edit mode state
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [editedDays, setEditedDays] = useState<Set<string>>(new Set());

  const [isSaving, setIsSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    const c = await getCycles(user.id);
    setCycles(c);
    setIsLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Last cycle (most recent)
  const lastCycle = cycles[0] ?? null;

  // Is there an active cycle (started but not ended)?
  const hasActiveCycle = !!lastCycle && !lastCycle.end_date;

  // ── helpers ────────────────────────────────────────────────────────────────

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(v => v - 1); }
    else setViewMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(v => v + 1); }
    else setViewMonth(m => m + 1);
  };

  // Enter edit mode: pre-fill with current cycle's days (or last cycle if no active)
  const enterEditMode = () => {
    const ref = lastCycle;
    if (ref) {
      setEditedDays(cycleToDays(ref));
      // Navigate calendar to the month of that cycle
      const s = parseDate(ref.start_date);
      setViewYear(s.getFullYear());
      setViewMonth(s.getMonth());
    } else {
      setEditedDays(new Set());
      setViewYear(today.getFullYear());
      setViewMonth(today.getMonth());
    }
    setMode('edit');
  };

  // Toggle a day in edit mode
  const toggleDay = (dateStr: string) => {
    if (dateStr > todayStr) return; // can't select future
    setEditedDays(prev => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr);
      else next.add(dateStr);
      return next;
    });
  };

  // ── actions ────────────────────────────────────────────────────────────────

  const handleStartCycle = async () => {
    if (!user) return;
    setIsSaving(true);
    await saveCycle(user.id, todayStr, undefined);
    setSavedMsg('Cycle démarré !');
    await load();
    setIsSaving(false);
    setTimeout(() => navigate('/'), 1200);
  };

  const handleEndCycle = async () => {
    if (!user) return;
    setIsSaving(true);
    await endCurrentCycle(user.id, todayStr);
    setSavedMsg('Cycle terminé !');
    await load();
    setIsSaving(false);
    setTimeout(() => navigate('/'), 1200);
  };

  const handleSaveEdit = async () => {
    if (!user || editedDays.size === 0) return;
    setIsSaving(true);
    await saveCycleFromDays(user.id, Array.from(editedDays));
    setSavedMsg('Modifications enregistrées !');
    await load();
    setIsSaving(false);
    setTimeout(() => navigate('/'), 1200);
  };

  // ── calendar helpers ───────────────────────────────────────────────────────

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  // All days currently in any cycle (for background display)
  const allCycleDays = new Set<string>();
  for (const c of cycles) {
    if (c === lastCycle && mode === 'edit') continue; // edited separately
    for (const d of cycleToDays(c)) allCycleDays.add(d);
  }

  // Summary line for edit mode
  const editedSorted = Array.from(editedDays).sort();
  const editSummary = editedSorted.length === 0
    ? 'Aucun jour sélectionné'
    : editedSorted.length === 1
    ? `Le ${parseDate(editedSorted[0]).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`
    : `Du ${parseDate(editedSorted[0]).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} au ${parseDate(editedSorted[editedSorted.length - 1]).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} · ${editedSorted.length} jours`;

  // ── render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-surface">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  // ── Success overlay ────────────────────────────────────────────────────────
  if (savedMsg) {
    return (
      <div className="min-h-dvh bg-surface flex flex-col items-center justify-center gap-4">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-4xl icon-fill">check_circle</span>
        </div>
        <p className="font-headline font-bold text-xl text-on-surface">{savedMsg}</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-surface flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-surface/80 backdrop-blur-xl flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => mode === 'edit' ? setMode('view') : navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-surface-container hover:bg-surface-container-high transition-colors active:scale-95"
          >
            <span className="material-symbols-outlined text-on-surface-variant text-xl">arrow_back</span>
          </button>
          <h1 className="font-headline font-bold text-lg text-on-surface tracking-tight">
            {mode === 'edit' ? 'Modifier / renseigner un cycle' : 'Renseigner le cycle'}
          </h1>
        </div>
      </header>

      <main className="flex-1 px-5 pt-4 pb-10">

        {/* ══ VIEW MODE ═══════════════════════════════════════════════════════ */}
        {mode === 'view' && (
          <>
            {/* Status card */}
            <section className="bg-surface-container-lowest rounded-[2rem] p-6 mb-6 shadow-[0_8px_30px_rgba(0,0,0,0.03)] flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-primary text-4xl icon-fill">water_drop</span>
              </div>

              {/* ── 0 données ── */}
              {!lastCycle && (
                <>
                  <h2 className="font-headline font-bold text-xl text-on-surface mb-1">Bienvenue !</h2>
                  <p className="text-on-surface-variant text-sm leading-relaxed mb-6">
                    Pour commencer le suivi, indiquez si vos règles ont démarré aujourd'hui, ou renseignez un cycle passé pour que les prévisions soient précises dès le départ.
                  </p>
                  <div className="w-full space-y-3">
                    <button
                      onClick={handleStartCycle}
                      disabled={isSaving}
                      className="w-full py-4 bg-primary text-on-primary rounded-full font-headline font-bold text-base shadow-[0_8px_30px_rgba(161,59,87,0.25)] hover:opacity-90 transition-all active:scale-95 disabled:opacity-40"
                    >
                      {isSaving ? 'Enregistrement...' : 'Mes règles ont commencé aujourd\'hui'}
                    </button>
                    <button
                      onClick={() => { setEditedDays(new Set()); setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); setMode('edit'); }}
                      className="w-full py-3.5 bg-surface-container text-on-surface rounded-full font-headline font-semibold text-sm hover:bg-surface-container-high transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-lg text-on-surface-variant">edit_calendar</span>
                      Renseigner un cycle passé
                    </button>
                  </div>
                </>
              )}

              {/* ── Cycle en cours ── */}
              {lastCycle && hasActiveCycle && (
                <>
                  <h2 className="font-headline font-bold text-xl text-on-surface mb-1">Règles en cours</h2>
                  <p className="text-on-surface-variant text-sm leading-relaxed mb-1">
                    Commencé le{' '}
                    <span className="font-bold text-primary">
                      {parseDate(lastCycle.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                    </span>
                  </p>
                  <p className="text-on-surface-variant text-xs mb-6">
                    Jour {Math.floor((today.getTime() - parseDate(lastCycle.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1} des règles
                  </p>
                  <div className="w-full space-y-3">
                    <button
                      onClick={handleEndCycle}
                      disabled={isSaving}
                      className="w-full py-4 bg-primary text-on-primary rounded-full font-headline font-bold text-base shadow-[0_8px_30px_rgba(161,59,87,0.25)] hover:opacity-90 transition-all active:scale-95 disabled:opacity-40"
                    >
                      {isSaving ? 'Enregistrement...' : 'Mes règles sont terminées'}
                    </button>
                    <button
                      onClick={enterEditMode}
                      className="w-full py-3.5 bg-surface-container text-on-surface rounded-full font-headline font-semibold text-sm hover:bg-surface-container-high transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-lg text-on-surface-variant">edit_calendar</span>
                      Modifier / renseigner un cycle
                    </button>
                  </div>
                </>
              )}

              {/* ── Données mais pas de cycle en cours ── */}
              {lastCycle && !hasActiveCycle && (
                <>
                  <h2 className="font-headline font-bold text-xl text-on-surface mb-1">Nouveau cycle</h2>
                  <p className="text-on-surface-variant text-sm leading-relaxed mb-1">
                    Dernier cycle terminé le{' '}
                    <span className="font-bold text-on-surface">
                      {parseDate(lastCycle.end_date!).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                    </span>
                  </p>
                  <p className="text-on-surface-variant text-xs mb-6">
                    Appuyez ci-dessous dès que vos règles commencent
                  </p>
                  <div className="w-full space-y-3">
                    <button
                      onClick={handleStartCycle}
                      disabled={isSaving}
                      className="w-full py-4 bg-primary text-on-primary rounded-full font-headline font-bold text-base shadow-[0_8px_30px_rgba(161,59,87,0.25)] hover:opacity-90 transition-all active:scale-95 disabled:opacity-40"
                    >
                      {isSaving ? 'Enregistrement...' : 'Mes règles ont commencé'}
                    </button>
                    <button
                      onClick={enterEditMode}
                      className="w-full py-3.5 bg-surface-container text-on-surface rounded-full font-headline font-semibold text-sm hover:bg-surface-container-high transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-lg text-on-surface-variant">edit_calendar</span>
                      Modifier / renseigner un cycle
                    </button>
                  </div>
                </>
              )}
            </section>

            {/* Historique résumé */}
            {cycles.length > 0 && (
              <section>
                <h3 className="font-headline font-bold text-sm text-on-surface-variant uppercase tracking-wider mb-3 px-1">Historique récent</h3>
                <div className="space-y-2">
                  {cycles.slice(0, 4).map((c, idx) => (
                    <div key={c.id} className="bg-surface-container-lowest rounded-[1.25rem] px-5 py-4 flex items-center justify-between shadow-[0_2px_12px_rgba(46,51,53,0.04)]">
                      <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${idx === 0 && hasActiveCycle ? 'bg-primary animate-pulse' : 'bg-primary/40'}`} />
                        <div>
                          <p className="font-bold text-sm text-on-surface">
                            {parseDate(c.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                            {c.end_date && ` → ${parseDate(c.end_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`}
                          </p>
                          <p className="text-xs text-on-surface-variant">
                            {c.end_date
                              ? `${Math.round((parseDate(c.end_date).getTime() - parseDate(c.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1} jours de règles`
                              : idx === 0 ? 'En cours…' : 'Durée non renseignée'
                            }
                          </p>
                        </div>
                      </div>
                      {c.cycle_length && (
                        <span className="text-xs font-bold text-on-surface-variant bg-surface-container px-2.5 py-1 rounded-full">
                          Cycle {c.cycle_length}j
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* ══ EDIT MODE ════════════════════════════════════════════════════════ */}
        {mode === 'edit' && (          <>
            {/* Summary chip */}
            <div className="bg-primary/8 rounded-[1.25rem] px-4 py-3 mb-4 flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-lg shrink-0">calendar_month</span>
              <p className="text-primary text-sm font-bold">{editSummary}</p>
            </div>

            {/* Calendar */}
            <section className="bg-surface-container-lowest rounded-[2rem] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.03)] mb-4">
              {/* Month nav */}
              <div className="flex justify-between items-center mb-5">
                <h3 className="font-headline font-bold text-base text-on-surface">
                  {MONTH_NAMES[viewMonth]} {viewYear}
                </h3>
                <div className="flex gap-2">
                  <button onClick={prevMonth} className="w-9 h-9 flex items-center justify-center rounded-full bg-surface-container hover:bg-surface-container-high transition-colors active:scale-90">
                    <span className="material-symbols-outlined text-on-surface-variant">chevron_left</span>
                  </button>
                  <button onClick={nextMonth} className="w-9 h-9 flex items-center justify-center rounded-full bg-surface-container hover:bg-surface-container-high transition-colors active:scale-90">
                    <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
                  </button>
                </div>
              </div>

              {/* Day labels */}
              <div className="grid grid-cols-7 mb-2">
                {['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'].map((d) => (
                  <div key={d} className="text-center text-[9px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60">
                    {d}
                  </div>
                ))}
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7 gap-y-1">
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-10" />
                ))}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isFuture = dateStr > todayStr;
                  const isToday = dateStr === todayStr;
                  const isEdited = editedDays.has(dateStr);
                  // Other cycles (not being edited) shown as background
                  const isOtherCycle = allCycleDays.has(dateStr);

                  // Neighbours for range background coloring
                  const prevDay = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day - 1).padStart(2, '0')}`;
                  const nextDay = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day + 1).padStart(2, '0')}`;
                  const prevEdited = editedDays.has(prevDay);
                  const nextEdited = editedDays.has(nextDay);

                  return (
                    <div
                      key={day}
                      onClick={() => !isFuture && toggleDay(dateStr)}
                      className={`h-10 flex items-center justify-center relative ${isFuture ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {/* Range stripe behind the circle */}
                      {isEdited && prevEdited && (
                        <div className="absolute left-0 w-1/2 h-full bg-primary/12 z-0" />
                      )}
                      {isEdited && nextEdited && (
                        <div className="absolute right-0 w-1/2 h-full bg-primary/12 z-0" />
                      )}

                      {/* Circle */}
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center z-10 text-sm font-bold transition-all active:scale-90 relative
                        ${isEdited
                          ? 'bg-primary text-on-primary shadow-[0_4px_12px_rgba(161,59,87,0.3)]'
                          : isOtherCycle
                          ? 'bg-primary/10 text-primary'
                          : isToday
                          ? 'ring-2 ring-primary text-primary'
                          : isFuture
                          ? 'text-on-surface-variant'
                          : 'text-on-surface hover:bg-surface-container'
                        }`}
                      >
                        {isEdited && (
                          <span className="material-symbols-outlined absolute text-[10px] top-0.5 right-0.5 text-on-primary/70 icon-fill" style={{ fontSize: 10 }}>water_drop</span>
                        )}
                        {day}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-4 flex items-center gap-5 justify-center">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-primary" />
                  <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">Sélectionné</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-primary/10" />
                  <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">Autre cycle</span>
                </div>
              </div>
            </section>

            <p className="text-center text-on-surface-variant text-xs mb-5">
              Touchez un jour pour l'ajouter ou le retirer · Naviguez entre les mois
            </p>

            {/* Save / cancel */}
            <div className="space-y-3">
              <button
                onClick={handleSaveEdit}
                disabled={isSaving || editedDays.size === 0}
                className="w-full py-4 bg-primary text-on-primary rounded-full font-headline font-bold text-base shadow-[0_8px_30px_rgba(161,59,87,0.25)] hover:opacity-90 transition-all active:scale-95 disabled:opacity-40"
              >
                {isSaving ? 'Enregistrement...' : `Enregistrer (${editedDays.size} jour${editedDays.size > 1 ? 's' : ''})`}
              </button>
              <button
                onClick={() => setMode('view')}
                className="w-full py-3.5 bg-surface-container text-on-surface rounded-full font-headline font-semibold text-sm hover:bg-surface-container-high transition-all active:scale-95"
              >
                Annuler
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
