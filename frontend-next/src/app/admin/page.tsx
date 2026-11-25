"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { Activity, ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, BarChart3, BriefcaseBusiness, Clock3, Command, Cpu, FileText, Film, Gauge, Layers3, LockKeyhole, LogOut, Mail, RefreshCw, ShieldCheck, Users, WalletCards, XCircle } from "lucide-react";
import { login, logout } from "@/lib/auth";
import { useAuth } from "@/lib/AuthContext";
import { AdminApiError, fetchAdminOverview, fetchAdminRecords, sendSmtpTest, type AdminCollection, type AdminOverview, type AdminRecords } from "@/lib/admin";
import styles from "./admin.module.css";

function number(value: number) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function timeLabel(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function SignIn({ onSignedIn, statusMessage }: { onSignedIn: () => Promise<void>; statusMessage?: string }) {
  const { refresh: refreshAuth } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login({ email: email.trim().toLowerCase(), password });
      await refreshAuth();
      await onSignedIn();
    } catch (err) {
      try { await logout(); } catch {}
      await refreshAuth();
      setError(err instanceof Error ? err.message : "Sign in failed. Check your credentials and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.loginShell}>
      <section className={styles.loginCard} aria-labelledby="admin-login-heading">
        <div className={styles.loginBrand}><span className={styles.logoMark}>R</span><span>RelatiV <i>Control room</i></span></div>
        <div className={styles.lockBadge}><LockKeyhole size={18} /></div>
        <p className={styles.eyebrow}>Private workspace</p>
        <h1 id="admin-login-heading">Good to have you back.</h1>
        <p className={styles.loginCopy}>Sign in with an authorized founder account to view platform operations.</p>
        <form className={styles.loginForm} onSubmit={submit}>
          {statusMessage && <p className={styles.formError} role="status">{statusMessage}</p>}
          <label htmlFor="admin-email">Email address</label>
          <input id="admin-email" type="email" autoComplete="username" placeholder="you@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <label htmlFor="admin-password">Password</label>
          <input id="admin-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className={styles.formError} role="alert">{error}</p>}
          <button className={styles.primaryButton} disabled={busy} type="submit">{busy ? "Checking access…" : "Sign in securely"}<ArrowUpRight size={17} /></button>
        </form>
        <p className={styles.setupLink}>First time here? <Link href="/admin/setup">Create your verified creator account</Link></p>
        <div className={styles.loginFoot}><ShieldCheck size={15} /> Verified email and an active account are required.</div>
      </section>
      <div className={styles.loginAside} aria-hidden="true">
        <div className={styles.asideGrid} />
        <div className={styles.asideContent}><span>THE CREATOR ENGINE</span><h2>Know what’s moving.<br />See what needs you.</h2><p>One clear view of RelatiV’s processing, creators, and marketplace activity.</p><div className={styles.asideSignal}><span /> Platform telemetry ready</div></div>
        <div className={styles.asideFooter}>RELATIV / INTERNAL SYSTEMS</div>
      </div>
    </main>
  );
}

function WeekChart({ data }: { data: AdminOverview["daily_generated"] }) {
  const days = useMemo(() => {
    const map = new Map(data.map((item) => [item.date, item.count]));
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      return { label: date.toLocaleDateString("en-US", { weekday: "short" }), count: map.get(iso) || 0 };
    });
  }, [data]);
  const max = Math.max(...days.map((day) => day.count), 1);
  return <div className={styles.chart} role="img" aria-label={`Clip generation over the last seven days: ${days.map((d) => `${d.label} ${d.count}`).join(", ")}`}>
    {days.map((day) => <div className={styles.chartCol} key={day.label}>
      <span className={styles.chartValue}>{day.count ? number(day.count) : ""}</span>
      <div className={styles.chartTrack}><div className={styles.chartBar} style={{ height: `${Math.max(day.count / max * 100, day.count ? 10 : 2)}%` }} /></div>
      <span className={styles.chartDay}>{day.label}</span>
    </div>)}
  </div>;
}

function SmtpTestButton() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleTest() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await sendSmtpTest("deepraj@relativclips.com");
      setStatus({ ok: true, text: `Sent to ${res.to}` });
    } catch (err) {
      setStatus({ ok: false, text: err instanceof Error ? err.message : "SMTP test failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <button type="button" className={styles.textButton} onClick={() => void handleTest()} disabled={busy}>
        <Mail size={13} /> {busy ? "Sending SMTP test…" : "Send SMTP Test"}
      </button>
      {status && (
        <small style={{ color: status.ok ? "#34D399" : "#FB7185", fontSize: "12px" }} role="status">
          {status.text}
        </small>
      )}
    </div>
  );
}

const COLLECTIONS: Array<{ id: AdminCollection | "overview"; label: string; icon: typeof Gauge }> = [
  { id: "overview", label: "Overview", icon: Gauge },
  { id: "users", label: "Accounts", icon: Users },
  { id: "jobs", label: "Processing jobs", icon: Activity },
  { id: "clips", label: "Generated clips", icon: Film },
  { id: "campaigns", label: "Campaigns", icon: Layers3 },
  { id: "submissions", label: "Clip submissions", icon: BriefcaseBusiness },
  { id: "applications", label: "Clipper applications", icon: FileText },
  { id: "brand_contacts", label: "Brand contacts", icon: Mail },
  { id: "quotes", label: "Campaign quotes", icon: WalletCards },
  { id: "system", label: "System & spend", icon: Cpu },
  { id: "audit_logs", label: "Audit logs", icon: ShieldCheck },
];

function RecordsView({ collection }: { collection: AdminCollection }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [records, setRecords] = useState<AdminRecords | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const definition = COLLECTIONS.find((item) => item.id === collection);

  useEffect(() => {
    const id = window.setTimeout(() => { setDebouncedQuery(query.trim()); setPage(1); }, 250);
    return () => window.clearTimeout(id);
  }, [query]);
  useEffect(() => {
    let alive = true;
    fetchAdminRecords(collection, page, debouncedQuery)
      .then((response) => { if (alive) { setRecords(response); setError(""); } })
      .catch((err) => { if (alive) setError(err instanceof Error ? err.message : "Could not load records."); })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [collection, page, debouncedQuery]);
  useEffect(() => {
    let alive = true;
    const refresh = () => fetchAdminRecords(collection, page, debouncedQuery)
      .then((response) => { if (alive) { setRecords(response); setError(""); } })
      .catch((err) => { if (alive) setError(err instanceof Error ? err.message : "Could not refresh records."); });
    const id = window.setInterval(refresh, 15000);
    return () => { alive = false; window.clearInterval(id); };
  }, [collection, page, debouncedQuery]);

  const rows = records?.records || [];
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const maxPage = Math.max(1, Math.ceil((records?.total || 0) / 25));
  return <section className={styles.recordsPanel}>
    <div className={styles.recordsIntro}><div><p className={styles.eyebrow}>Platform records</p><h1>{definition?.label}</h1><p>Search and inspect records available to founder accounts.</p></div><div className={styles.recordCount}>{number(records?.total || 0)} <span>records</span></div></div>
    <div className={styles.recordsToolbar}><label className={styles.searchBox}><span className={styles.searchGlyph}>⌕</span><input aria-label={`Search ${definition?.label}`} placeholder={`Search ${definition?.label?.toLowerCase()}…`} value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>⌘ K</kbd></label><span className={styles.refreshHint}><RefreshCw size={13} /> Search updates as you type</span></div>
    <div className={styles.recordsTableWrap}>
      {busy ? <div className={styles.recordsLoading}><span className={styles.loadingMark}>R</span>Loading records…</div> : error ? <div className={styles.recordsLoading}>{error}</div> : rows.length ? <table className={styles.recordsTable}><thead><tr>{columns.map((column) => <th key={column}>{column.replaceAll("_", " ")}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={String(row.id || row.task_id || row.clip_id || `${page}-${index}`)}>{columns.map((column) => {
        const value = row[column];
        const text = typeof value === "boolean" ? (value ? "Yes" : "No") : value == null || value === "" ? "—" : String(value);
        return <td key={column} title={text}>{text}</td>;
      })}</tr>)}</tbody></table> : <div className={styles.recordsLoading}><Film size={18} />No records match this search.</div>}
    </div>
    <div className={styles.pagination}><span>Showing {records?.total ? (page - 1) * 25 + 1 : 0}–{Math.min(page * 25, records?.total || 0)} of {number(records?.total || 0)}</span><div><button disabled={page <= 1 || busy} onClick={() => setPage((current) => Math.max(1, current - 1))} aria-label="Previous page"><ArrowLeft size={15} /></button><span>Page {page} of {maxPage}</span><button disabled={page >= maxPage || busy} onClick={() => setPage((current) => Math.min(maxPage, current + 1))} aria-label="Next page"><ArrowRight size={15} /></button></div></div>
  </section>;
}

function Dashboard({ data, onRefresh, onLogout, refreshing, updatedAt, activeView, onView }: {
  data: AdminOverview;
  onRefresh: () => void;
  onLogout: () => void;
  refreshing: boolean;
  updatedAt: Date;
  activeView: AdminCollection | "overview";
  onView: (view: AdminCollection | "overview") => void;
}) {
  const successRate = data.jobs.success_rate;
  return <div className={styles.appShell}>
    <aside className={styles.sidebar}>
      <div className={styles.sideBrand}><span className={styles.logoMark}>R</span><span>RelatiV<small>CONTROL ROOM</small></span></div>
      <div className={styles.sideSection}>PLATFORM DATA</div>
      <nav className={styles.sideNav} aria-label="Admin sections">{COLLECTIONS.map(({ id, label, icon: Icon }) => <button key={id} className={`${styles.navItem} ${activeView === id ? styles.navActive : ""}`} onClick={() => onView(id)}><Icon size={17} />{label}{id === "jobs" && data.jobs.active_now > 0 && <span className={styles.navCount}>{data.jobs.active_now}</span>}</button>)}</nav>
      <div className={styles.sidebarBottom}>
        <Link className={styles.studioLink} href="/dashboard"><Film size={15} />Open creator studio<ArrowUpRight size={13} /></Link>
        <div className={styles.protectedNote}><ShieldCheck size={16} /><span>Founder access<br /><b>Verified email required</b></span></div>
        <button className={styles.logoutButton} onClick={onLogout}><LogOut size={16} />Sign out</button>
      </div>
    </aside>

    <main className={styles.mainPanel} id="overview">
      <header className={styles.topbar}>
        <div className={styles.breadcrumb}><Command size={15} /><span>RelatiV</span><b>/</b><strong>{COLLECTIONS.find((item) => item.id === activeView)?.label}</strong></div>
        <div className={styles.topActions}><span className={styles.updated}><span />Updated {updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span><button className={styles.refreshButton} onClick={onRefresh} disabled={refreshing} aria-label="Refresh dashboard"><RefreshCw size={16} className={refreshing ? styles.spinning : ""} /></button><button className={styles.avatar} aria-label="Founder account">D</button></div>
      </header>

      {activeView === "overview" ? <div className={styles.content}>
        <section className={styles.welcomeRow}>
          <div><p className={styles.eyebrow}>{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p><h1>Your platform, at a glance.</h1><p className={styles.subhead}>The signal behind every short-form story.</p></div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <SmtpTestButton />
            <div className={styles.livePill}><span />Systems reporting</div>
          </div>
        </section>

        <section className={styles.metricGrid} aria-label="Platform metrics">
          <article className={`${styles.metricCard} ${styles.metricFeature}`}><div className={styles.metricHeader}><span>Clips created</span><Film size={17} /></div><strong>{number(data.generated_clips.all_time)}</strong><div className={styles.metricFoot}><span className={styles.metricDelta}>+{number(data.generated_clips.last_24h)}</span> in the last 24 hours</div><div className={styles.featureRule}><span style={{ width: `${Math.min(100, data.generated_clips.last_7d ? 22 + data.generated_clips.last_7d * 4 : 4)}%` }} /></div><small>{number(data.generated_clips.last_7d)} generated this week</small></article>
          <article className={styles.metricCard}><div className={styles.metricHeader}><span>Jobs completed</span><Activity size={17} /></div><strong>{number(data.jobs.completed)}</strong><div className={styles.metricFoot}><span className={styles.successText}>{successRate}% success</span><span> · {number(data.jobs.failed)} failed</span></div></article>
          <article className={styles.metricCard}><div className={styles.metricHeader}><span>Enabled accounts</span><Users size={17} /></div><strong>{number(data.accounts.active)}</strong><div className={styles.metricFoot}>{number(data.accounts.new_last_7d)} new this week</div></article>
          <article className={styles.metricCard}><div className={styles.metricHeader}><span>Live campaigns</span><Layers3 size={17} /></div><strong>{number(data.marketplace.live_campaigns)}</strong><div className={styles.metricFoot}>{number(data.marketplace.submitted_clips)} clips submitted</div></article>
        </section>

        <section className={styles.middleGrid}>
          <article className={styles.panel}>
            <div className={styles.panelHeading}><div><h2>Clip output</h2><p>Generated clips · last 7 days</p></div><span className={styles.panelIcon}><BarChart3 size={17} /></span></div>
            <WeekChart data={data.daily_generated} />
            <div className={styles.chartSummary}><span><i className={styles.legendBlue} />Created clips</span><b>{number(data.generated_clips.last_7d)} total</b></div>
          </article>
          <article className={styles.panel} id="processing">
            <div className={styles.panelHeading}><div><h2>Processing queue</h2><p>Current backend workload</p></div><span className={styles.queuePulse}><span />Live</span></div>
            <div className={styles.queueNumbers}><div><span>In progress</span><b>{number(data.jobs.active_now)}</b></div><div><span>Waiting</span><b>{number(data.jobs.queued_now)}</b></div></div>
            <div className={styles.queueFoot}><Clock3 size={15} /><span>Task snapshots refresh every {data.refresh_interval_seconds} seconds</span></div>
          </article>
        </section>

        <section className={styles.activityPanel}>
          <div className={styles.panelHeading}><div><h2>Recent processing</h2><p>Latest jobs recorded by the platform</p></div><button className={styles.textButton} onClick={onRefresh}>Refresh <RefreshCw size={13} /></button></div>
          {data.recent_jobs.length ? <div className={styles.tableWrap}><table><thead><tr><th>Source</th><th>Task</th><th>Status</th><th>Progress</th><th>Started</th></tr></thead><tbody>
            {data.recent_jobs.map((job) => <tr key={job.id}><td><span className={styles.sourceIcon}><Film size={14} /></span>{job.source}</td><td><code>{job.id.slice(0, 8)}</code>{job.error && <small className={styles.jobError} title={job.error}><XCircle size={12} />{job.error}</small>}</td><td><span className={`${styles.statusBadge} ${job.status === "complete" ? styles.statusComplete : job.status === "failed" ? styles.statusFailed : styles.statusActive}`}><i />{job.status}</span></td><td><div className={styles.progressCell}><span><i style={{ width: `${Math.max(0, Math.min(100, job.progress))}%` }} /></span><small>{job.progress}%</small></div></td><td className={styles.timeCell}>{timeLabel(job.created_at)}</td></tr>)}
          </tbody></table></div> : <div className={styles.emptyState}><Film size={22} /><span>No processing jobs have been recorded yet.</span></div>}
        </section>

        <section className={styles.marketRow} id="marketplace">
          <div className={styles.marketCopy}><span className={styles.marketIcon}><WalletCards size={18} /></span><div><h2>Marketplace pulse</h2><p>Campaign performance tracked by RelatiV</p></div></div>
          <div className={styles.marketStat}><span>Views tracked</span><b>{number(data.marketplace.tracked_views)}</b></div>
          <div className={styles.marketStat}><span>Campaign spend</span><b>${(data.marketplace.campaign_spend_cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></div>
          <div className={styles.marketFootnote}><ArrowDownToLine size={14} />Reported marketplace data</div>
        </section>

        <footer className={styles.pageFooter}><span>RELATIV SYSTEMS</span><span>All-time totals reflect records persisted by the current backend.</span><span>API · {timeLabel(data.generated_at)}</span></footer>
      </div> : <div className={styles.content}><RecordsView collection={activeView} /></div>}
    </main>
  </div>;
}

export default function AdminPage() {
  const { logout: logoutAuth } = useAuth();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(new Date());
  const [accessError, setAccessError] = useState("");
  const [signedOut, setSignedOut] = useState(false);
  const [activeView, setActiveView] = useState<AdminCollection | "overview">("overview");

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const overview = await fetchAdminOverview();
      setData(overview);
      setAccessError("");
      setSignedOut(false);
      setUpdatedAt(new Date());
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        setData(null);
        setAccessError("");
        setSignedOut(false);
      } else if (error instanceof AdminApiError && error.status === 403) {
        setData(null);
        setAccessError(error.message);
        setSignedOut(true);
      } else {
        setAccessError(error instanceof Error ? error.message : "The admin API is unavailable.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);
  useEffect(() => {
    if (!data) return;
    const id = window.setInterval(() => void load(), data.refresh_interval_seconds * 1000);
    return () => window.clearInterval(id);
  }, [data, load]);

  async function signOut() {
    await logoutAuth("/admin");
    setData(null);
    setSignedOut(false);
    setAccessError("");
  }

  if (loading) return <main className={styles.loadingShell}><span className={styles.loadingMark}>R</span><p>Securing the control room…</p></main>;
  if (!data) {
    if (signedOut) return <main className={styles.denied}><div className={styles.deniedMark}><ShieldCheck size={23} /></div><p className={styles.eyebrow}>Access restricted</p><h1>This account can’t enter the control room.</h1><p>{accessError || "Only verified founder accounts are authorized."}</p><button className={styles.primaryButton} onClick={signOut}>Sign out and switch account <ArrowUpRight size={17} /></button></main>;
    return <SignIn statusMessage={accessError} onSignedIn={async () => { await load(true); }} />;
  }
  return <Dashboard data={data} updatedAt={updatedAt} refreshing={refreshing} onRefresh={() => void load(true)} onLogout={() => void signOut()} activeView={activeView} onView={setActiveView} />;
}
