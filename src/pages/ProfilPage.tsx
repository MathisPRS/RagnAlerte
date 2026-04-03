import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { updateUserEmail, updateUserPassword, exportUserData, getNoPeriodMode, setNoPeriodMode } from '../services/db';
import { hashPassword, verifyPassword } from '../utils/crypto';

export function ProfilPage() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [showEmailForm, setShowEmailForm] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const [newEmail, setNewEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const [isSaving, setIsSaving] = useState(false);

  // No-period mode
  const [noPeriodEnabled, setNoPeriodEnabled] = useState(false);
  const [noPeriodRefDate, setNoPeriodRefDate] = useState('');

  useEffect(() => {
    if (!user) return;
    const mode = getNoPeriodMode(user.id);
    setNoPeriodEnabled(mode.enabled);
    setNoPeriodRefDate(mode.referenceDate ?? '');
  }, [user]);

  const handleNoPeriodToggle = () => {
    if (!user) return;
    const next = !noPeriodEnabled;
    setNoPeriodEnabled(next);
    setNoPeriodMode(user.id, next, noPeriodRefDate || null);
  };

  const handleNoPeriodRefDate = (val: string) => {
    if (!user) return;
    setNoPeriodRefDate(val);
    setNoPeriodMode(user.id, noPeriodEnabled, val || null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setEmailError('');
    setEmailSuccess('');
    if (!newEmail.trim() || !newEmail.includes('@')) {
      setEmailError('Email invalide.');
      return;
    }
    setIsSaving(true);
    await updateUserEmail(user.id, newEmail.toLowerCase().trim());
    await refreshUser();
    setEmailSuccess('Email mis à jour.');
    setNewEmail('');
    setShowEmailForm(false);
    setIsSaving(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword.length < 6) {
      setPasswordError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Les mots de passe ne correspondent pas.');
      return;
    }

    const valid = await verifyPassword(currentPassword, user.password_hash);
    if (!valid) {
      setPasswordError('Mot de passe actuel incorrect.');
      return;
    }

    setIsSaving(true);
    const hash = await hashPassword(newPassword);
    await updateUserPassword(user.id, hash);
    await refreshUser();
    setPasswordSuccess('Mot de passe mis à jour.');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswordForm(false);
    setIsSaving(false);
  };

  const handleExport = async () => {
    if (!user) return;
    const data = await exportUserData(user.id);
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ragn-alerte-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-surface min-h-full">
      {/* TopAppBar */}
      <header className="sticky top-0 z-40 bg-surface/80 backdrop-blur-xl flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary">bubble_chart</span>
          <h1 className="font-headline font-bold text-xl tracking-tight text-primary">RagnAlerte</h1>
        </div>
      </header>

      <main className="px-6 pt-6 pb-4">
        {/* Profile header */}
        <header className="flex flex-col items-center mb-10">
          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-primary to-secondary-container flex items-center justify-center mb-4 shadow-[0_8px_30px_rgba(161,59,87,0.15)]">
            <span className="font-headline font-bold text-white text-4xl">
              {user?.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <h2 className="font-headline text-2xl text-on-surface tracking-tight">{user?.name}</h2>
          <p className="text-on-surface-variant font-medium text-sm mt-1">{user?.email}</p>
        </header>

        <div className="space-y-8">
          {/* Email success / password success messages */}
          {emailSuccess && (
            <div className="bg-tertiary-container/30 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="material-symbols-outlined text-tertiary icon-fill text-sm">check_circle</span>
              <p className="text-tertiary text-sm font-medium">{emailSuccess}</p>
            </div>
          )}
          {passwordSuccess && (
            <div className="bg-tertiary-container/30 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="material-symbols-outlined text-tertiary icon-fill text-sm">check_circle</span>
              <p className="text-tertiary text-sm font-medium">{passwordSuccess}</p>
            </div>
          )}

          {/* Confidentialité */}
          <section>
            <h3 className="font-headline text-[11px] uppercase tracking-[0.2em] text-on-surface-variant px-1 mb-3">Confidentialité</h3>
            <div className="bg-surface-container-low rounded-[1.5rem] overflow-hidden p-1 space-y-1">
              {/* Password */}
              <button
                onClick={() => { setShowPasswordForm(!showPasswordForm); setShowEmailForm(false); }}
                className="w-full flex items-center justify-between p-4 bg-surface-container-lowest rounded-[1.25rem] hover:bg-surface-container-low transition-colors group active:scale-[0.99]"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary-container/20 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined">lock</span>
                  </div>
                  <span className="text-on-surface font-medium">Changer de mot de passe</span>
                </div>
                <span className={`material-symbols-outlined text-outline-variant transition-transform ${showPasswordForm ? 'rotate-90' : 'group-hover:translate-x-1'}`}>
                  chevron_right
                </span>
              </button>

              {showPasswordForm && (
                <form onSubmit={handleUpdatePassword} className="px-4 pb-4 space-y-3">
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Mot de passe actuel"
                    required
                    className="w-full bg-surface-container-low rounded-full px-4 py-3 text-on-surface placeholder:text-outline-variant focus:outline-none focus:ring-2 focus:ring-primary-container text-sm"
                  />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nouveau mot de passe (min. 6 caractères)"
                    required
                    className="w-full bg-surface-container-low rounded-full px-4 py-3 text-on-surface placeholder:text-outline-variant focus:outline-none focus:ring-2 focus:ring-primary-container text-sm"
                  />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirmer le nouveau mot de passe"
                    required
                    className="w-full bg-surface-container-low rounded-full px-4 py-3 text-on-surface placeholder:text-outline-variant focus:outline-none focus:ring-2 focus:ring-primary-container text-sm"
                  />
                  {passwordError && (
                    <p className="text-error text-xs font-medium px-2">{passwordError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full py-3 bg-primary text-on-primary rounded-full font-bold text-sm hover:opacity-90 active:scale-95 disabled:opacity-60"
                  >
                    {isSaving ? 'Enregistrement...' : 'Mettre à jour'}
                  </button>
                </form>
              )}

              {/* Email */}
              <button
                onClick={() => { setShowEmailForm(!showEmailForm); setShowPasswordForm(false); }}
                className="w-full flex items-center justify-between p-4 bg-surface-container-lowest rounded-[1.25rem] hover:bg-surface-container-low transition-colors group active:scale-[0.99]"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-secondary-container/30 flex items-center justify-center text-secondary">
                    <span className="material-symbols-outlined">mail</span>
                  </div>
                  <span className="text-on-surface font-medium">Changer d'adresse e-mail</span>
                </div>
                <span className={`material-symbols-outlined text-outline-variant transition-transform ${showEmailForm ? 'rotate-90' : 'group-hover:translate-x-1'}`}>
                  chevron_right
                </span>
              </button>

              {showEmailForm && (
                <form onSubmit={handleUpdateEmail} className="px-4 pb-4 space-y-3">
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Nouvel email"
                    required
                    className="w-full bg-surface-container-low rounded-full px-4 py-3 text-on-surface placeholder:text-outline-variant focus:outline-none focus:ring-2 focus:ring-primary-container text-sm"
                  />
                  {emailError && (
                    <p className="text-error text-xs font-medium px-2">{emailError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full py-3 bg-primary text-on-primary rounded-full font-bold text-sm hover:opacity-90 active:scale-95 disabled:opacity-60"
                  >
                    {isSaving ? 'Enregistrement...' : 'Mettre à jour'}
                  </button>
                </form>
              )}
            </div>
          </section>

          {/* Mode sans règles */}
          <section>
            <h3 className="font-headline text-[11px] uppercase tracking-[0.2em] text-on-surface-variant px-1 mb-3">Cycle</h3>
            <div className="bg-surface-container-low rounded-[1.5rem] p-1 space-y-1">
              <div className="px-4 py-4 bg-surface-container-lowest rounded-[1.25rem] space-y-4">
                {/* Toggle row */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <span className="material-symbols-outlined">pill</span>
                    </div>
                    <div>
                      <p className="text-on-surface font-medium text-sm">Mode sans règles</p>
                      <p className="text-on-surface-variant text-xs mt-0.5">Pilule continue ou aménorrhée</p>
                    </div>
                  </div>
                  {/* Toggle switch */}
                  <button
                    onClick={handleNoPeriodToggle}
                    className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${noPeriodEnabled ? 'bg-primary' : 'bg-outline-variant/40'}`}
                    aria-label="Activer mode sans règles"
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${noPeriodEnabled ? 'left-[1.5rem]' : 'left-0.5'}`}
                    />
                  </button>
                </div>

                {/* Reference date — only shown when enabled */}
                {noPeriodEnabled && (
                  <div className="pt-2 border-t border-outline-variant/20">
                    <p className="text-on-surface-variant text-xs mb-2">
                      Date de référence (dernier début de règles théorique ou début de pilule)
                    </p>
                    <input
                      type="date"
                      value={noPeriodRefDate}
                      onChange={(e) => handleNoPeriodRefDate(e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                      className="w-full bg-surface-container-low rounded-full px-4 py-3 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container text-sm"
                    />
                    <p className="text-on-surface-variant text-[11px] mt-2 px-1">
                      Le cycle théorique de 28 jours sera calculé depuis cette date. Les phases et prévisions sont simulées — aucune règle réelle n'est attendue.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Mes données */}
          <section>
            <h3 className="font-headline text-[11px] uppercase tracking-[0.2em] text-on-surface-variant px-1 mb-3">Mes Données</h3>
            <div className="bg-surface-container-low rounded-[1.5rem] p-1">
              <button
                onClick={handleExport}
                className="w-full flex items-center justify-between p-4 bg-surface-container-lowest rounded-[1.25rem] hover:bg-surface-container-low transition-colors group active:scale-[0.99]"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-tertiary-container/30 flex items-center justify-center text-tertiary">
                    <span className="material-symbols-outlined">download</span>
                  </div>
                  <div className="text-left">
                    <span className="text-on-surface block font-medium">Exporter mes données</span>
                    <span className="text-[11px] text-on-surface-variant uppercase tracking-wider">Format JSON</span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-outline-variant group-hover:translate-x-1 transition-transform">chevron_right</span>
              </button>
            </div>
          </section>

          {/* Déconnexion */}
          <section className="pt-2">
            <button
              onClick={handleLogout}
              className="w-full py-4 border border-outline-variant/20 rounded-full text-on-surface-variant font-medium hover:bg-surface-container/50 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">logout</span>
              Déconnexion
            </button>
          </section>
        </div>
      </main>
    </div>
  );
}
