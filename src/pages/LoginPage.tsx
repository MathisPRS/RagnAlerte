import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUser, getUserByEmail } from '../services/db';
import { hashPassword, verifyPassword } from '../utils/crypto';
import { useAuth } from '../contexts/AuthContext';

type Mode = 'login' | 'register';

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (mode === 'register') {
        if (!name.trim()) {
          setError('Veuillez entrer votre prénom.');
          return;
        }
        const existing = await getUserByEmail(email.toLowerCase().trim());
        if (existing) {
          setError('Un compte existe déjà avec cet email.');
          return;
        }
        if (password.length < 6) {
          setError('Le mot de passe doit contenir au moins 6 caractères.');
          return;
        }
        const hash = await hashPassword(password);
        await createUser(email.toLowerCase().trim(), hash, name.trim());
        const newUser = await getUserByEmail(email.toLowerCase().trim());
        if (newUser) {
          login(newUser);
          navigate('/', { replace: true });
        }
      } else {
        const user = await getUserByEmail(email.toLowerCase().trim());
        if (!user) {
          setError('Email ou mot de passe incorrect.');
          return;
        }
        const ok = await verifyPassword(password, user.password_hash);
        if (!ok) {
          setError('Email ou mot de passe incorrect.');
          return;
        }
        login(user);
        navigate('/', { replace: true });
      }
    } catch (err) {
      setError('Une erreur est survenue. Réessayez.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-surface flex flex-col">
      {/* Hero section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Logo area */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4 shadow-[0_0_40px_rgba(161,59,87,0.12)]">
            <span className="material-symbols-outlined text-primary text-4xl icon-fill">water_drop</span>
          </div>
          <h1 className="font-headline text-3xl font-extrabold text-primary tracking-tight">RagnAlerte</h1>
          <p className="text-on-surface-variant text-sm mt-1 font-body">Votre suivi de cycle personnel</p>
        </div>

        {/* Card */}
        <div className="w-full max-w-sm bg-surface-container-lowest rounded-[2rem] p-8 shadow-[0_8px_40px_rgba(46,51,53,0.06)]">
          {/* Tab switch */}
          <div className="flex bg-surface-container-low rounded-full p-1 mb-8">
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 py-2.5 rounded-full text-sm font-bold transition-all duration-200 ${
                mode === 'login'
                  ? 'bg-surface-container-lowest text-primary shadow-sm'
                  : 'text-on-surface-variant'
              }`}
            >
              Connexion
            </button>
            <button
              onClick={() => { setMode('register'); setError(''); }}
              className={`flex-1 py-2.5 rounded-full text-sm font-bold transition-all duration-200 ${
                mode === 'register'
                  ? 'bg-surface-container-lowest text-primary shadow-sm'
                  : 'text-on-surface-variant'
              }`}
            >
              Inscription
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">
                  Prénom
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Clara"
                  required
                  className="w-full bg-surface-container-low rounded-full px-5 py-3.5 text-on-surface placeholder:text-outline-variant focus:outline-none focus:ring-2 focus:ring-primary-container font-body text-sm"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="clara@exemple.com"
                required
                className="w-full bg-surface-container-low rounded-full px-5 py-3.5 text-on-surface placeholder:text-outline-variant focus:outline-none focus:ring-2 focus:ring-primary-container font-body text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">
                Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-surface-container-low rounded-full px-5 py-3.5 text-on-surface placeholder:text-outline-variant focus:outline-none focus:ring-2 focus:ring-primary-container font-body text-sm"
              />
            </div>

            {error && (
              <div className="bg-error-container/20 rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="material-symbols-outlined text-error text-sm">error</span>
                <p className="text-error text-sm font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-primary text-on-primary rounded-full font-headline font-bold text-base shadow-[0_8px_30px_rgba(161,59,87,0.25)] hover:opacity-90 transition-all active:scale-95 disabled:opacity-60 mt-2"
            >
              {isLoading ? 'Chargement...' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
            </button>
          </form>
        </div>

        <p className="text-on-surface-variant text-xs mt-8 text-center max-w-xs leading-relaxed">
          Vos données sont stockées localement sur cet appareil et ne sont jamais partagées.
        </p>
      </div>
    </div>
  );
}
