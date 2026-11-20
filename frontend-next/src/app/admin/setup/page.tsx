"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, CheckCircle2, LockKeyhole, ShieldCheck } from "lucide-react";
import { signup } from "@/lib/auth";
import styles from "../admin.module.css";

export default function AdminSetupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await signup({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role: "creator",
        accept_tos: acceptTerms,
        redirectTo: "/admin",
      });
      setCreated(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Account setup failed. Try again.";
      setError(message.includes("409") || message.toLowerCase().includes("already exists")
        ? "An account already uses this email. Sign in or reset its password instead."
        : message);
    } finally {
      setBusy(false);
    }
  }

  return <main className={styles.loginShell}>
    <section className={styles.loginCard} aria-labelledby="setup-heading">
      <div className={styles.loginBrand}><span className={styles.logoMark}>R</span><span>RelatiV <i>Founder setup</i></span></div>
      {created ? <>
        <div className={styles.lockBadge}><CheckCircle2 size={19} /></div>
        <p className={styles.eyebrow}>One more step</p>
        <h1 id="setup-heading">Verify your email.</h1>
        <p className={styles.loginCopy}>We created your creator workspace. Open the Supabase verification link sent to <strong>{email}</strong>. After verification, you’ll return to the Control Room. Founder access is only enabled for a verified allowlisted address.</p>
        <div className={styles.setupNotice}><ShieldCheck size={16} />These credentials also work in the creator studio, so you can generate clips from the same account.</div>
        <Link href="/admin" className={styles.primaryButton}>Continue to sign in <ArrowUpRight size={17} /></Link>
      </> : <>
        <div className={styles.lockBadge}><LockKeyhole size={18} /></div>
        <p className={styles.eyebrow}>Secure account creation</p>
        <h1 id="setup-heading">Set up your creator access.</h1>
        <p className={styles.loginCopy}>Use one of the authorized founder email addresses. The server verifies the address before granting Control Room access.</p>
        <form className={styles.loginForm} onSubmit={submit}>
          <label htmlFor="founder-name">Name</label>
          <input id="founder-name" autoComplete="name" required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} />
          <label htmlFor="founder-email">Founder email</label>
          <input id="founder-email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
          <label htmlFor="founder-password">Password <span className={styles.labelHint}>12+ characters</span></label>
          <input id="founder-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} />
          <label className={styles.termsCheck}>
            <input type="checkbox" required checked={acceptTerms} onChange={(event) => setAcceptTerms(event.target.checked)} />
            <span>I accept RelatiV’s Terms of Service and Privacy Policy.</span>
          </label>
          {error && <p className={styles.formError} role="alert">{error}</p>}
          <button className={styles.primaryButton} disabled={busy} type="submit">{busy ? "Creating account…" : "Create creator account"}<ArrowUpRight size={17} /></button>
        </form>
        <p className={styles.setupLink}><Link href="/admin"><ArrowLeft size={13} /> Back to Control Room sign in</Link></p>
      </>}
      <div className={styles.loginFoot}><ShieldCheck size={15} /> Passwords are stored as one-way hashes; sessions use HttpOnly cookies.</div>
    </section>
    <div className={styles.loginAside} aria-hidden="true">
      <div className={styles.asideGrid} />
      <div className={styles.asideContent}><span>RELATIV CREATOR STUDIO</span><h2>From one source<br />to the next great clip.</h2><p>Your founder account can move between platform operations and the creator workflow.</p><div className={styles.asideSignal}><span /> Email verification required</div></div>
      <div className={styles.asideFooter}>RELATIV / INTERNAL SYSTEMS</div>
    </div>
  </main>;
}
