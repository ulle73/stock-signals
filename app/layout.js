import './globals.css';
import './macro-matrix-colors.css';
import './restyle.css';
import ThemeToggle from './theme-toggle';

const navItems = [
  { href: '#oversikt', label: 'Översikt', icon: '⌂' },
  { href: '#signaler', label: 'Signaler', icon: '◇' },
  { href: '#ma200', label: 'MA200-bucket', icon: '◒' },
  { href: '#data', label: 'Datatäckning', icon: '▤' },
  { href: '#makro', label: 'Makro', icon: '⌁' },
  { href: '#backtester', label: 'Backtester', icon: '↗' },
  { href: '#ticker', label: 'Ticker', icon: '◎' },
  { href: '#alla-aktier', label: 'Alla aktier', icon: '▦' },
];

export const metadata = {
  title: 'Stock Signals',
  description: 'Daily market data status for S&P 500 breadth work.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="sv" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var savedTheme = localStorage.getItem('theme');
                  if (!savedTheme) {
                    savedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  }
                  document.documentElement.setAttribute('data-theme', savedTheme);
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        <div className="app-frame">
          <aside className="side-nav" aria-label="Huvudnavigation">
            <a className="side-brand" href="#oversikt" aria-label="Gå till översikt">
              <span className="side-brand-mark">↗</span>
              <span>Stock Signals</span>
            </a>

            <nav className="side-nav-links" aria-label="Dashboard-kategorier">
              {navItems.map((item) => (
                <a className="side-nav-link" href={item.href} key={item.href}>
                  <span className="side-nav-icon" aria-hidden="true">{item.icon}</span>
                  <span>{item.label}</span>
                </a>
              ))}
            </nav>

            <div className="side-nav-footer" aria-label="Status">
              <div className="side-status-pill">
                <span className="side-status-dot" />
                <div>
                  <strong>Dashboard</strong>
                  <span>Uppdateras dagligen</span>
                </div>
              </div>
            </div>
          </aside>

          <div className="app-main">
            <div className="top-bar">
              <div className="top-search" aria-label="Sökfält">
                <span aria-hidden="true">⌕</span>
                <span>Sök ticker, signal eller setup…</span>
              </div>
              <ThemeToggle />
            </div>
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
