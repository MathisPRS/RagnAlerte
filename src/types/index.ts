// Types for the application
export interface User {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  created_at: string;
}

export interface Cycle {
  id: number;
  user_id: number;
  start_date: string; // ISO date string
  end_date: string | null;
  cycle_length: number | null;
  notes: string | null;
}

export interface DailyLog {
  id: number;
  user_id: number;
  date: string; // ISO date string
  mood: number | null; // 1-100
  libido: number | null; // 1-100
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Symptom {
  id: number;
  user_id: number;
  date: string; // ISO date string
  symptom_type: SymptomType;
}

export type SymptomType =
  | 'crampes'
  | 'ballonnement'
  | 'maux_tete'
  | 'saignement'
  | 'insomnie'
  | 'vertiges'
  | 'nausee'
  | 'acne'
  | 'fringale'
  | 'fatigue'
  | 'seins_sensibles'
  | 'dos';

export type CyclePhase =
  | 'menstrual'
  | 'follicular'
  | 'ovulation'
  | 'luteal';

export interface CycleInfo {
  phase: CyclePhase;
  dayInCycle: number;
  totalCycleLength: number;
  // Next period
  nextPeriodDate: Date | null;
  daysUntilNextPeriod: number | null; // negative = late
  isLate: boolean;
  daysLate: number; // 0 if not late
  // Ovulation
  ovulationDate: Date | null;
  daysUntilOvulation: number | null; // negative = ovulation passed
  fertilityWindowStart: Date | null;
  fertilityWindowEnd: Date | null;
  isInFertileWindow: boolean;
  // Period duration estimate
  avgPeriodDuration: number;
  // Current period (if in menstrual phase)
  currentPeriodStart: Date | null;
  periodDayNumber: number | null; // e.g. "Jour 2 des règles"
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
}
