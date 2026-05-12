import './globals.css';
import GlobalManufacturingPmiSection from './global-manufacturing-pmi-section.js';

export const metadata = {
  title: 'Stock Signals',
  description: 'Daily market data status for S&P 500 breadth work.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <GlobalManufacturingPmiSection />
      </body>
    </html>
  );
}
