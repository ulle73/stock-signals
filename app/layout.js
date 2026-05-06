import './globals.css';

export const metadata = {
  title: 'Stock Signals',
  description: 'Daily market data status for S&P 500 breadth work.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
