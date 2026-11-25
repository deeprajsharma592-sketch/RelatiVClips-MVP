/** Branded first-paint and session-check loader for the creator studio. */
export default function DashboardLoading() {
  return (
    <main
      role="status"
      aria-label="Loading RelatiV dashboard"
      className="dashboard-loading fixed inset-0 z-[100] grid min-h-screen place-items-center overflow-hidden bg-[#09090C] text-white"
    >
      <div className="dashboard-loading__glow" aria-hidden="true" />
      <div className="relative flex flex-col items-center gap-5">
        <div className="dashboard-loading__mark" aria-hidden="true">
          <svg viewBox="0 0 192 104" fill="none">
            <rect className="dashboard-loading__bar dashboard-loading__bar--1" x="6" y="39" width="14" height="26" rx="7" />
            <rect className="dashboard-loading__bar dashboard-loading__bar--2" x="32" y="27" width="14" height="50" rx="7" />
            <rect className="dashboard-loading__bar dashboard-loading__bar--3" x="58" y="8" width="14" height="88" rx="7" />
            <rect className="dashboard-loading__bar dashboard-loading__bar--4" x="84" y="26" width="14" height="52" rx="7" />
            <rect className="dashboard-loading__bar dashboard-loading__bar--5" x="110" y="34" width="14" height="36" rx="7" />
            <path d="M148 14.2c-4.5-3-10.6.2-10.6 5.6v64.4c0 5.4 6.1 8.6 10.6 5.6l36.5-26.2a14 14 0 0 0 0-23.2L148 14.2Z" fill="#EF43AA" />
          </svg>
        </div>
        <span className="font-display text-lg font-semibold tracking-tight text-white">Relati<span className="bg-gradient-to-br from-[#FFB94A] via-[#FF765F] to-[#EF43AA] bg-clip-text text-transparent">V</span></span>
        <span className="text-xs tracking-[0.18em] text-white/45">OPENING YOUR STUDIO</span>
      </div>
    </main>
  );
}
