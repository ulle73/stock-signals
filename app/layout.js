import './globals.css';
import './macro-matrix-colors.css';
import ThemeToggle from './theme-toggle';

export const metadata = {
  title: 'Stock Signals',
  description: 'Daily market data status for S&P 500 breadth work.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
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
        <div className="top-bar">
          <div className="brand">Stock Signals</div>
          <ThemeToggle />
        </div>
        {children}
      </body>
    </html>
  );
}
