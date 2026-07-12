import ThemeToggle from './theme-toggle.js';
import DashboardIcon from './dashboard-icons.js';

const navItems = [
  { href: '#oversikt', icon: 'grid', label: 'Översikt' },
  { href: '#signaler', icon: 'signal', label: 'Signaler' },
  { href: '#alla-aktier', icon: 'eye', label: 'Bevakning' },
  { href: '#options', icon: 'target', label: 'Options' },
  { href: '#sektorer', icon: 'layers', label: 'Sektorer' },
  { href: '#signaler', icon: 'clock', label: 'Historik' },
  { icon: 'settings', label: 'Inställningar' },
];

export default function DashboardTopNav({ updatedLabel }) {
  return (
    <header className="market-topbar">
      <a className="market-brand" href="#oversikt">
        <span className="market-brand-mark"><DashboardIcon name="signal" size={22} /></span>
        <span>Market<span>Signals</span></span>
      </a>
      <nav className="market-top-nav" aria-label="Huvudnavigation">
        {navItems.map((item) => (item.href ? (
          <a className={item.label === 'Översikt' ? 'is-active' : undefined} href={item.href} key={item.label}>
            <DashboardIcon name={item.icon} size={15} />
            {item.label}
          </a>
        ) : (
          <span aria-disabled="true" key={item.label}>
            <DashboardIcon name={item.icon} size={15} />
            {item.label}
          </span>
        ))) }
      </nav>
      <div className="market-topbar-meta">
        <span className="market-live-dot" aria-hidden="true" />
        <span>{updatedLabel}</span>
        <ThemeToggle />
      </div>
    </header>
  );
}
