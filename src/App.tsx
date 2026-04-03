import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { EnregistrerReglesPage } from './pages/EnregistrerReglesPage';
import { NotesPage } from './pages/NotesPage';
import { CalendrierPage } from './pages/CalendrierPage';
import { ProfilPage } from './pages/ProfilPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/calendrier" element={<CalendrierPage />} />
              <Route path="/profil" element={<ProfilPage />} />
              <Route path="/enregistrer-regles" element={<EnregistrerReglesPage />} />
              <Route path="/notes" element={<NotesPage />} />
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
