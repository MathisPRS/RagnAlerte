import { NavLink, useLocation } from 'react-router-dom';

interface NavItem {
  to: string;
  icon: string;
  label: string;
}

const navItems: NavItem[] = [
  { to: '/', icon: 'flare', label: "Aujourd'hui" },
  { to: '/calendrier', icon: 'calendar_today', label: 'Calendrier' },
  { to: '/profil', icon: 'person', label: 'Profil' },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav
      className="fixed bottom-0 z-50 flex justify-around items-center px-4 pt-3 bg-white/80 backdrop-blur-xl border-t border-surface-container/15 shadow-[0_-8px_40px_rgba(46,51,53,0.04)] rounded-t-[2.5rem]"
      style={{
        width: '100%',
        maxWidth: '480px',
        left: '50%',
        transform: 'translateX(-50%)',
        paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      {navItems.map((item) => {
        const isActive = item.to === '/'
          ? location.pathname === '/'
          : location.pathname.startsWith(item.to);

        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={`flex flex-col items-center justify-center px-5 py-2 rounded-full transition-all duration-300 active:scale-90 ${
              isActive
                ? 'text-primary font-bold bg-secondary-container/30'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <span
              className="material-symbols-outlined text-2xl"
              style={isActive ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" } : undefined}
            >
              {item.icon}
            </span>
            <span className="font-body font-medium text-[11px] mt-0.5">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
