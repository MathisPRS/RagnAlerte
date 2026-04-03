import { Outlet, useLocation } from 'react-router-dom';
import { BottomNav } from './BottomNav';

// Routes that should NOT show the bottom nav
const NO_NAV_ROUTES = ['/enregistrer-regles', '/notes'];

export function AppLayout() {
  const location = useLocation();
  const showNav = !NO_NAV_ROUTES.some((r) => location.pathname.startsWith(r));

  return (
    <div className="flex flex-col min-h-dvh bg-surface">
      <main className={showNav ? 'flex-1 pb-36' : 'flex-1'}>
        <Outlet />
      </main>
      {showNav && <BottomNav />}
    </div>
  );
}
