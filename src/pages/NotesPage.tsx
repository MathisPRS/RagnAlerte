import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { saveDailyLog, getDailyLog, saveSymptoms, getSymptomsForDate } from '../services/db';
import { formatDate } from '../utils/cycle';

interface SymptomDef {
  key: string;
  icon: string;
  label: string;
}

const SYMPTOMS: SymptomDef[] = [
  { key: 'crampes',         icon: 'waves',           label: 'Crampes' },
  { key: 'ballonnement',    icon: 'air',             label: 'Ballonnement' },
  { key: 'maux_tete',       icon: 'psychology',      label: 'Maux de tête' },
  { key: 'saignement',      icon: 'water_drop',      label: 'Saignement' },
  { key: 'insomnie',        icon: 'dark_mode',       label: 'Insomnie' },
  { key: 'vertiges',        icon: 'cyclone',         label: 'Vertiges' },
  { key: 'nausee',          icon: 'sick',            label: 'Nausée' },
  { key: 'acne',            icon: 'face',            label: 'Acné' },
  { key: 'fringale',        icon: 'restaurant',      label: 'Fringale' },
  { key: 'fatigue',         icon: 'battery_very_low',label: 'Fatigue' },
  { key: 'seins_sensibles', icon: 'favorite',        label: 'Seins sensibles' },
];

type FluxLevel = 'saignement_leger' | 'saignement_moyen' | 'saignement_abondant' | null;

const FLUX_OPTIONS: { key: NonNullable<FluxLevel>; label: string; sublabel: string; dots: number }[] = [
  { key: 'saignement_leger',    label: 'Léger',    sublabel: 'Quelques gouttes',  dots: 1 },
  { key: 'saignement_moyen',    label: 'Moyen',    sublabel: 'Flux normal',       dots: 2 },
  { key: 'saignement_abondant', label: 'Abondant', sublabel: 'Flux important',    dots: 3 },
];

// ── Bottom sheet modal ────────────────────────────────────────────────────────
function FluxModal({
  current,
  onSelect,
  onDismiss,
}: {
  current: FluxLevel;
  onSelect: (f: NonNullable<FluxLevel>) => void;
  onDismiss: () => void;
}) {
  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(46,51,53,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={onDismiss}
    >
      {/* Sheet */}
      <div
        className="w-full max-w-[480px] bg-surface-container-lowest rounded-t-[2rem] pb-10 pt-5 px-6 shadow-[0_-16px_60px_rgba(46,51,53,0.12)]"
        style={{ animation: 'slideUp 0.25s cubic-bezier(0.32,0.72,0,1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-outline-variant/50 rounded-full mx-auto mb-6" />

        {/* Title */}
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary icon-fill" style={{ fontSize: 20 }}>water_drop</span>
          </div>
          <div>
            <h2 className="font-headline font-bold text-lg text-on-surface leading-tight">Intensité du flux</h2>
            <p className="text-on-surface-variant text-xs">Sélectionne le niveau qui correspond le mieux</p>
          </div>
        </div>

        {/* Options */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          {FLUX_OPTIONS.map((opt) => {
            const isActive = current === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => onSelect(opt.key)}
                className={`flex flex-col items-center justify-center py-5 px-2 rounded-[1.5rem] transition-all active:scale-95 ${
                  isActive
                    ? 'bg-primary text-on-primary shadow-[0_6px_20px_rgba(161,59,87,0.3)]'
                    : 'bg-surface-container hover:bg-surface-container-high'
                }`}
              >
                {/* Drops */}
                <div className="flex items-end justify-center gap-1 mb-3">
                  {Array.from({ length: 3 }).map((_, i) => {
                    const filled = i < opt.dots;
                    const px = 14 + i * 5;
                    return (
                      <span
                        key={i}
                        className="material-symbols-outlined leading-none"
                        style={{
                          fontSize: px,
                          fontVariationSettings: filled ? "'FILL' 1" : "'FILL' 0",
                          color: isActive
                            ? filled ? 'rgba(255,247,247,0.95)' : 'rgba(255,247,247,0.3)'
                            : filled ? '#a13b57' : '#dee3e5',
                        }}
                      >
                        water_drop
                      </span>
                    );
                  })}
                </div>
                <span className={`text-sm font-bold ${isActive ? 'text-on-primary' : 'text-on-surface'}`}>
                  {opt.label}
                </span>
                <span className={`text-[10px] mt-0.5 ${isActive ? 'text-on-primary/70' : 'text-on-surface-variant'}`}>
                  {opt.sublabel}
                </span>
              </button>
            );
          })}
        </div>

        {/* Cancel */}
        <button
          onClick={onDismiss}
          className="w-full mt-4 py-3 text-on-surface-variant text-sm font-semibold"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function NotesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = new Date();
  const todayStr = formatDate(today);

  const [selectedSymptoms, setSelectedSymptoms] = useState<Set<string>>(new Set());
  const [flux, setFlux] = useState<FluxLevel>(null);
  const [showFluxModal, setShowFluxModal] = useState(false);
  const [mood, setMood] = useState(50);
  const [libido, setLibido] = useState(50);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const log = await getDailyLog(user.id, todayStr);
      if (log) {
        setMood(log.mood ?? 50);
        setLibido(log.libido ?? 50);
        setNotes(log.notes ?? '');
      }
      const syms = await getSymptomsForDate(user.id, todayStr);
      const fluxKey = syms.find((s) => s.startsWith('saignement_')) as FluxLevel ?? null;
      const baseSyms = syms.filter((s) => !s.startsWith('saignement_'));
      if (fluxKey) baseSyms.push('saignement');
      setSelectedSymptoms(new Set(baseSyms));
      setFlux(fluxKey);
      setIsLoading(false);
    };
    load();
  }, [user, todayStr]);

  const toggleSymptom = (key: string) => {
    if (key === 'saignement') {
      if (selectedSymptoms.has('saignement')) {
        // Décocher → reset flux aussi
        setSelectedSymptoms((prev) => { const n = new Set(prev); n.delete('saignement'); return n; });
        setFlux(null);
      } else {
        // Cocher → ouvrir le modal de flux
        setSelectedSymptoms((prev) => { const n = new Set(prev); n.add('saignement'); return n; });
        setShowFluxModal(true);
      }
      return;
    }
    setSelectedSymptoms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleFluxSelect = (f: NonNullable<FluxLevel>) => {
    setFlux(f);
    setShowFluxModal(false);
  };

  const handleFluxDismiss = () => {
    // If no flux was ever chosen and modal is dismissed, deselect saignement
    if (!flux) {
      setSelectedSymptoms((prev) => { const n = new Set(prev); n.delete('saignement'); return n; });
    }
    setShowFluxModal(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    const finalSymptoms = Array.from(selectedSymptoms).filter((s) => s !== 'saignement');
    if (selectedSymptoms.has('saignement') && flux) {
      finalSymptoms.push(flux);
    } else if (selectedSymptoms.has('saignement')) {
      finalSymptoms.push('saignement');
    }
    await saveDailyLog(user.id, todayStr, mood, libido, notes || null);
    await saveSymptoms(user.id, todayStr, finalSymptoms);
    setIsSaving(false);
    setSaved(true);
    setTimeout(() => navigate('/'), 1200);
  };

  // Flux dot count for the saignement button icon area
  const fluxDots = flux === 'saignement_leger' ? 1 : flux === 'saignement_moyen' ? 2 : flux === 'saignement_abondant' ? 3 : 0;
  const fluxLabel = flux === 'saignement_leger' ? 'Léger' : flux === 'saignement_moyen' ? 'Moyen' : flux === 'saignement_abondant' ? 'Abondant' : 'Saignement';

  const todayDisplay = today.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-surface">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="min-h-dvh bg-surface flex flex-col">
        {/* TopAppBar */}
        <header className="sticky top-0 z-40 bg-surface/80 backdrop-blur-xl flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-surface-container hover:bg-surface-container-high transition-colors active:scale-95"
            >
              <span className="material-symbols-outlined text-on-surface-variant">arrow_back_ios</span>
            </button>
            <h1 className="font-headline font-bold text-lg text-primary tracking-tight">Notes du jour</h1>
          </div>
          <span className="font-headline font-bold text-transparent bg-clip-text bg-gradient-to-br from-primary to-primary-container text-sm">RagnAlerte</span>
        </header>

        <main className="flex-1 px-6 pt-6 pb-8 space-y-8">
          {/* Header */}
          <section>
            <p className="text-on-surface-variant font-medium tracking-wide uppercase text-[10px]">Aujourd'hui, {todayDisplay}</p>
            <h2 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight leading-tight mt-1">Comment vous sentez-vous ?</h2>
          </section>

          {/* Physical Symptoms */}
          <section>
            <div className="flex justify-between items-end mb-4">
              <h3 className="font-headline text-lg font-bold text-on-surface">Symptômes physiques</h3>
              {selectedSymptoms.size > 0 && (
                <span className="text-xs font-semibold text-primary">{selectedSymptoms.size} sélectionné{selectedSymptoms.size > 1 ? 's' : ''}</span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {SYMPTOMS.map((s) => {
                const isSelected = selectedSymptoms.has(s.key);
                const isSaignement = s.key === 'saignement';
                // For saignement: show flux drops if a level is selected, otherwise water_drop icon
                return (
                  <button
                    key={s.key}
                    onClick={() => toggleSymptom(s.key)}
                    className={`flex flex-col items-center justify-center p-4 rounded-[1.25rem] transition-all active:scale-95 relative ${
                      isSelected
                        ? 'bg-surface-container-lowest border-2 border-primary/20'
                        : 'bg-surface-container-low'
                    }`}
                  >
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center mb-2.5 transition-colors ${
                      isSelected ? 'bg-primary/10' : 'bg-secondary/10'
                    }`}>
                      {isSaignement && flux ? (
                        // Show flux drops inside the circle
                        <div className="flex items-end justify-center gap-0.5">
                          {Array.from({ length: 3 }).map((_, i) => {
                            const filled = i < fluxDots;
                            const px = 10 + i * 3; // 10 / 13 / 16px — compact for the circle
                            return (
                              <span
                                key={i}
                                className="material-symbols-outlined leading-none"
                                style={{
                                  fontSize: px,
                                  fontVariationSettings: filled ? "'FILL' 1" : "'FILL' 0",
                                  color: filled ? '#a13b57' : '#dee3e5',
                                }}
                              >
                                water_drop
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span
                          className={`material-symbols-outlined text-xl ${isSelected ? 'text-primary' : 'text-secondary'}`}
                          style={isSelected ? { fontVariationSettings: "'FILL' 1" } : undefined}
                        >
                          {s.icon}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-bold text-on-surface tracking-wide text-center leading-tight">
                      {isSaignement && flux ? fluxLabel : s.label}
                    </span>
                    {/* Edit flux hint when already selected */}
                    {isSaignement && flux && (
                      <span
                        className="absolute top-1.5 right-1.5 w-4 h-4 bg-primary/15 rounded-full flex items-center justify-center"
                        onClick={(e) => { e.stopPropagation(); setShowFluxModal(true); }}
                      >
                        <span className="material-symbols-outlined text-primary" style={{ fontSize: 10 }}>edit</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Mood Slider */}
          <section className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-headline text-lg font-bold text-on-surface">État émotionnel</h3>
              <span className="text-xl">✨</span>
            </div>
            <div className="bg-surface-container-low p-5 rounded-[1.5rem]">
              <div className="flex justify-between mb-3 px-1">
                <span className="material-symbols-outlined text-on-surface-variant text-xl">sentiment_very_dissatisfied</span>
                <span className="font-headline font-bold text-primary text-sm">{mood}%</span>
                <span className="material-symbols-outlined text-primary text-xl icon-fill">sentiment_very_satisfied</span>
              </div>
              <input
                type="range" min={1} max={100} value={mood}
                onChange={(e) => setMood(Number(e.target.value))}
                className="custom-slider w-full"
              />
              <div className="flex justify-between mt-2 px-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                <span>Calme</span><span>Épanouie</span>
              </div>
            </div>
          </section>

          {/* Libido Slider */}
          <section className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-headline text-lg font-bold text-on-surface">Libido</h3>
              <span className="text-xl">🔥</span>
            </div>
            <div className="bg-surface-container-low p-5 rounded-[1.5rem]">
              <div className="flex justify-between mb-3 px-1">
                <span className="material-symbols-outlined text-on-surface-variant text-xl">favorite_border</span>
                <span className="font-headline font-bold text-primary text-sm">{libido}%</span>
                <span className="material-symbols-outlined text-primary text-xl icon-fill">favorite</span>
              </div>
              <input
                type="range" min={1} max={100} value={libido}
                onChange={(e) => setLibido(Number(e.target.value))}
                className="custom-slider w-full"
              />
              <div className="flex justify-between mt-2 px-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                <span>Basse</span><span>Haute</span>
              </div>
            </div>
          </section>

          {/* Personal notes */}
          <section className="space-y-3">
            <h3 className="font-headline text-lg font-bold text-on-surface">Notes personnelles</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Comment s'est passée votre journée ?"
              rows={5}
              className="w-full bg-surface-container-low rounded-[1.5rem] p-5 text-on-surface placeholder:text-outline-variant focus:outline-none focus:ring-2 focus:ring-primary-container transition-all resize-none font-body text-sm leading-relaxed"
            />
          </section>

          {/* Save */}
          <section>
            {saved ? (
              <div className="w-full py-4 bg-tertiary-container/40 text-tertiary rounded-full font-headline font-bold text-base flex items-center justify-center gap-2">
                <span className="material-symbols-outlined icon-fill">check_circle</span>
                Journée enregistrée !
              </div>
            ) : (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full py-4 bg-primary text-on-primary rounded-full font-headline font-bold text-base shadow-[0_8px_30px_rgba(161,59,87,0.25)] hover:opacity-90 transition-all active:scale-95 disabled:opacity-60"
              >
                {isSaving ? 'Enregistrement...' : 'Enregistrer ma journée'}
              </button>
            )}
          </section>
        </main>
      </div>

      {/* Flux modal — rendered outside the page scroll */}
      {showFluxModal && (
        <FluxModal
          current={flux}
          onSelect={handleFluxSelect}
          onDismiss={handleFluxDismiss}
        />
      )}
    </>
  );
}
