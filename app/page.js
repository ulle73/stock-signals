export default function Home() {
  return (
    <main style={{ padding: 32, fontFamily: 'system-ui, sans-serif' }}>
      <h1>Stock Signals</h1>
      <p>Phase 1: Data Foundation</p>
      <p>Use <code>npm run db:migrate</code> and <code>npm run fetch:daily</code> to load market data.</p>
    </main>
  );
}
