const paths = {
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  signal: 'M3 17l5-5 4 3 8-9M16 6h4v4',
  eye: 'M2.5 12s3.5-6 9.5-6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6zm9.5 2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  layers: 'M12 3 3 8l9 5 9-5-9-5zm-9 9 9 5 9-5M3 16l9 5 9-5',
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  settings: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm0-12v2m0 13v2m8.5-8.5h-2m-13 0h-2',
  target: 'M12 3v3m0 12v3M3 12h3m12 0h3M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  shield: 'M12 3 4.5 6v5.5c0 4.4 3.1 7.7 7.5 9.5 4.4-1.8 7.5-5.1 7.5-9.5V6L12 3zm-3.2 9.1 2.1 2.1 4.4-4.4',
  gauge: 'M4 16a8 8 0 1 1 16 0M12 12l3.8-3.8M5 19h14',
  database: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zm0 0v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6m-16 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6',
};

export default function DashboardIcon({ name = 'grid', size = 16, title }) {
  return (
    <svg
      aria-hidden={title ? undefined : true}
      className="dashboard-icon"
      fill="none"
      height={size}
      role={title ? 'img' : undefined}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
      width={size}
    >
      {title ? <title>{title}</title> : null}
      <path d={paths[name] ?? paths.grid} />
    </svg>
  );
}
