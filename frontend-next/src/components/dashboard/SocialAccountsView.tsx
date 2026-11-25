"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  KeyRound,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import {
  ConnectedAccount,
  SocialPlatform,
  connectSocialAccount,
  disconnectSocialAccount,
  fetchSocialAccounts,
  refreshSocialAccount,
  startSocialOAuth,
  updateSocialAccount,
} from "@/lib/socials";

export function YoutubeIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

export function TiktokIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

export function InstagramIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

const PLATFORMS: Array<{
  id: SocialPlatform;
  label: string;
  subtitle: string;
  accentClass: string;
}> = [
  {
    id: "youtube",
    label: "YouTube",
    subtitle: "Shorts publishing & YouTube Analytics API",
    accentClass: "bg-red-600 text-white",
  },
  {
    id: "instagram",
    label: "Instagram",
    subtitle: "Reels publishing & Graph API insights",
    accentClass: "bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 text-white",
  },
];

export default function SocialAccountsView({
  onOpenCalendar,
}: {
  onOpenCalendar?: () => void;
}) {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [oauthAvailable, setOauthAvailable] = useState<{ youtube: boolean; instagram: boolean }>({
    youtube: false,
    instagram: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Connect / Update modal state
  const [modalPlatform, setModalPlatform] = useState<SocialPlatform | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [channelIdInput, setChannelIdInput] = useState("");
  const [accessTokenInput, setAccessTokenInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSocialAccounts();
      setAccounts(res.accounts || []);
      if (res.oauth_available) setOauthAvailable(res.oauth_available);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load social accounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const openModal = (platform: SocialPlatform, existing?: ConnectedAccount) => {
    setModalPlatform(platform);
    setChannelIdInput(existing?.platform_account_id || existing?.handle || "");
    setApiKeyInput("");
    setAccessTokenInput("");
    setModalError(null);
  };

  const handleOAuth = async (platform: SocialPlatform) => {
    setModalError(null);
    setSubmitting(true);
    try {
      const { auth_url } = await startSocialOAuth(platform);
      window.location.href = auth_url;
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Could not start OAuth flow.");
      setSubmitting(false);
    }
  };

  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalPlatform) return;
    setModalError(null);
    setSubmitting(true);
    try {
      await connectSocialAccount({
        platform: modalPlatform,
        channel_id: channelIdInput.trim() || undefined,
        api_key: apiKeyInput.trim() || undefined,
        access_token: accessTokenInput.trim() || undefined,
      });
      setModalPlatform(null);
      await loadAccounts();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Connection failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleAutoPublish = async (acc: ConnectedAccount) => {
    setBusyId(acc.id);
    try {
      const res = await updateSocialAccount(acc.id, { auto_publish: !acc.auto_publish });
      setAccounts((prev) => prev.map((a) => (a.id === acc.id ? res.account : a)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update account.");
    } finally {
      setBusyId(null);
    }
  };

  const handleRefresh = async (acc: ConnectedAccount) => {
    setBusyId(acc.id);
    try {
      const res = await refreshSocialAccount(acc.id);
      setAccounts((prev) => prev.map((a) => (a.id === acc.id ? res.account : a)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not refresh account.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDisconnect = async (acc: ConnectedAccount) => {
    setBusyId(acc.id);
    try {
      await disconnectSocialAccount(acc.id);
      setAccounts((prev) => prev.filter((a) => a.id !== acc.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disconnect account.");
    } finally {
      setBusyId(null);
    }
  };

  const byPlatform = new Map(accounts.map((a) => [a.platform, a]));

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
      {/* Clean Header */}
      <div className="flex flex-col gap-3 border-b border-white/[0.07] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-[#F4F1E8]">
            Social accounts
          </h1>
          <p className="mt-1 text-xs text-[#85868b]">
            Connect YouTube and Instagram to schedule posts on the calendar and pull live analytics.
          </p>
        </div>
        {onOpenCalendar && (
          <button
            type="button"
            onClick={onOpenCalendar}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.08] bg-[#18191b] px-3.5 text-xs font-medium text-white hover:bg-[#202226] transition cursor-pointer"
          >
            <Calendar size={14} />
            <span>Open calendar</span>
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Platform Connection Cards */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-xl border border-white/[0.06] bg-[#141517]"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {PLATFORMS.map((plat) => {
            const acc = byPlatform.get(plat.id);
            const isBusy = acc ? busyId === acc.id : false;

            return (
              <div
                key={plat.id}
                className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#141517] p-5 transition hover:border-white/[0.14]"
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {acc?.avatar_url ? (
                      <img
                        src={acc.avatar_url}
                        alt={acc.name}
                        className="h-10 w-10 rounded-lg object-cover border border-white/10 shrink-0"
                      />
                    ) : (
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-lg shrink-0 ${plat.accentClass}`}
                      >
                        {plat.id === "youtube" ? (
                          <YoutubeIcon className="w-5 h-5" />
                        ) : (
                          <InstagramIcon className="w-5 h-5" />
                        )}
                      </div>
                    )}

                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-semibold text-white">
                        {acc ? acc.name : plat.label}
                      </h2>
                      <p className="truncate text-xs text-[#85868b]">
                        {acc ? acc.handle : plat.subtitle}
                      </p>
                    </div>
                  </div>

                  {acc ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300 shrink-0">
                      <CheckCircle2 size={11} />
                      Connected
                    </span>
                  ) : (
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-0.5 text-[11px] text-[#77787d] shrink-0">
                      Not linked
                    </span>
                  )}
                </div>

                {/* Middle metadata */}
                <div className="my-4 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3.5 py-2.5 text-xs">
                  {acc ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#85868b]">Audience</span>
                      <span className="font-medium text-white">{acc.followers}</span>
                    </div>
                  ) : (
                    <p className="text-[#77787d] leading-relaxed">
                      Link via {plat.id === "youtube" ? "Google OAuth or YouTube API Key" : "Meta OAuth or Graph Access Token"}{" "}to enable scheduling &amp; analytics.
                    </p>
                  )}
                  {acc && (
                    <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-[#6f7075]">Capabilities</span>
                      <span className="text-[#a5a6aa]">
                        {acc.can_publish ? "Publish + Schedule + Analytics" : "Analytics & Schedule"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Bottom actions */}
                {acc ? (
                  <div className="flex items-center justify-between border-t border-white/[0.06] pt-3">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={acc.auto_publish}
                        disabled={isBusy}
                        onChange={() => handleToggleAutoPublish(acc)}
                        className="sr-only peer"
                      />
                      <div className="relative h-4 w-7 rounded-full bg-zinc-800 after:absolute after:top-[2px] after:left-[2px] after:h-3 after:w-3 after:rounded-full after:bg-white after:transition-all peer-checked:bg-emerald-500 peer-checked:after:translate-x-full" />
                      <span className="text-xs text-[#a5a6aa]">Auto-post</span>
                    </label>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openModal(plat.id, acc)}
                        disabled={isBusy}
                        className="rounded-md px-2 py-1 text-[11px] text-[#a5a6aa] hover:bg-white/[0.06] hover:text-white transition cursor-pointer"
                        title="Update API credentials"
                      >
                        <KeyRound size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRefresh(acc)}
                        disabled={isBusy}
                        className="rounded-md px-2 py-1 text-[11px] text-[#a5a6aa] hover:bg-white/[0.06] hover:text-white transition cursor-pointer"
                        title="Refresh channel stats"
                      >
                        <RefreshCw size={13} className={isBusy ? "animate-spin" : ""} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDisconnect(acc)}
                        disabled={isBusy}
                        className="rounded-md px-2 py-1 text-[11px] text-[#a5a6aa] hover:bg-red-500/10 hover:text-red-300 transition cursor-pointer"
                        title="Disconnect account"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => openModal(plat.id)}
                    className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-[#F4F1E8] text-xs font-semibold text-[#151515] hover:bg-white transition cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Connect {plat.label}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Connect / API Credentials Modal */}
      {modalPlatform && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-white/[0.1] bg-[#141517] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.07] pb-4">
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    modalPlatform === "youtube"
                      ? "bg-red-600 text-white"
                      : "bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 text-white"
                  }`}
                >
                  {modalPlatform === "youtube" ? (
                    <YoutubeIcon className="w-4 h-4" />
                  ) : (
                    <InstagramIcon className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Connect {modalPlatform === "youtube" ? "YouTube" : "Instagram"}
                  </h3>
                  <p className="text-[11px] text-[#85868b]">
                    {modalPlatform === "youtube"
                      ? "YouTube Data & Analytics API"
                      : "Instagram Graph API"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalPlatform(null)}
                className="rounded-md p-1 text-[#85868b] hover:bg-white/[0.06] hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {oauthAvailable[modalPlatform] && (
                <>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleOAuth(modalPlatform)}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#F4F1E8] text-xs font-semibold text-[#151515] hover:bg-white transition cursor-pointer disabled:opacity-50"
                  >
                    <Link2 size={14} />
                    <span>
                      Continue with {modalPlatform === "youtube" ? "Google OAuth" : "Meta OAuth"}
                    </span>
                  </button>
                  <div className="relative flex items-center py-1">
                    <div className="flex-grow border-t border-white/[0.08]" />
                    <span className="mx-3 text-[10px] uppercase tracking-wider text-[#6f7075]">
                      or enter API credentials
                    </span>
                    <div className="flex-grow border-t border-white/[0.08]" />
                  </div>
                </>
              )}

              <form onSubmit={handleConnectSubmit} className="space-y-3" autoComplete="off">
                {modalPlatform === "youtube" ? (
                  <>
                    <div className="rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2.5 text-[11px] leading-relaxed text-[#b6b7bc] space-y-1">
                      <p className="font-medium text-white/90">Where to get these credentials:</p>
                      <ul className="list-disc pl-4 space-y-0.5 text-[#9c9da3]">
                        <li>
                          <span className="text-white/80">API Key:</span>{" "}
                          <a
                            href="https://console.cloud.google.com/apis/library/youtube.googleapis.com"
                            target="_blank"
                            rel="noreferrer"
                            className="underline decoration-white/30 hover:text-white"
                          >
                            Google Cloud Console
                          </a>{" "}
                          → enable <strong>YouTube Data API v3</strong> → Credentials → Create API Key.
                        </li>
                        <li>
                          <span className="text-white/80">Channel ID / @Handle:</span> YouTube Studio → Settings → Channel → Advanced settings (or your <code className="text-white/75">@handle</code>).
                        </li>
                        <li>
                          <span className="text-white/80">OAuth Access Token:</span>{" "}
                          <a
                            href="https://developers.google.com/oauthplayground/"
                            target="_blank"
                            rel="noreferrer"
                            className="underline decoration-white/30 hover:text-white"
                          >
                            OAuth Playground
                          </a>{" "}
                          with <code className="text-white/75">youtube.upload</code> scope (only needed for direct Shorts publishing).
                        </li>
                      </ul>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-[#a5a6aa]">
                        YouTube API Key (Data / Analytics)
                      </label>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value)}
                        placeholder="AIzaSy..."
                        className="h-9 w-full rounded-md border border-white/[0.08] bg-[#0e0f11] px-3 text-xs text-white placeholder-[#5a5b60] focus:border-white/25 focus:outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-[#a5a6aa]">
                        Channel ID or @Handle
                      </label>
                      <input
                        type="text"
                        value={channelIdInput}
                        onChange={(e) => setChannelIdInput(e.target.value)}
                        placeholder="UC... or @yourchannel"
                        className="h-9 w-full rounded-md border border-white/[0.08] bg-[#0e0f11] px-3 text-xs text-white placeholder-[#5a5b60] focus:border-white/25 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-[#a5a6aa]">
                        OAuth Access Token{" "}
                        <span className="text-[#6f7075]">(optional, required for direct Shorts upload)</span>
                      </label>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={accessTokenInput}
                        onChange={(e) => setAccessTokenInput(e.target.value)}
                        placeholder="ya29...."
                        className="h-9 w-full rounded-md border border-white/[0.08] bg-[#0e0f11] px-3 text-xs text-white placeholder-[#5a5b60] focus:border-white/25 focus:outline-none font-mono"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2.5 text-[11px] leading-relaxed text-[#b6b7bc] space-y-1">
                      <p className="font-medium text-white/90">Where to get this token:</p>
                      <p className="text-[#9c9da3]">
                        Open{" "}
                        <a
                          href="https://developers.facebook.com/tools/explorer/"
                          target="_blank"
                          rel="noreferrer"
                          className="underline decoration-white/30 hover:text-white"
                        >
                          Meta Graph API Explorer
                        </a>{" "}
                        with a Business/Creator Instagram account linked to a Facebook Page and generate a token with{" "}
                        <code className="text-white/75">instagram_basic</code> and{" "}
                        <code className="text-white/75">instagram_content_publish</code>.
                      </p>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-[#a5a6aa]">
                        Instagram Graph API Access Token
                      </label>
                      <input
                        type="password"
                        autoComplete="new-password"
                        required
                        value={accessTokenInput}
                        onChange={(e) => setAccessTokenInput(e.target.value)}
                        placeholder="EAA..."
                        className="h-9 w-full rounded-md border border-white/[0.08] bg-[#0e0f11] px-3 text-xs text-white placeholder-[#5a5b60] focus:border-white/25 focus:outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-[#a5a6aa]">
                        Instagram Business Account ID{" "}
                        <span className="text-[#6f7075]">(optional, auto-detected)</span>
                      </label>
                      <input
                        type="text"
                        value={channelIdInput}
                        onChange={(e) => setChannelIdInput(e.target.value)}
                        placeholder="178414..."
                        className="h-9 w-full rounded-md border border-white/[0.08] bg-[#0e0f11] px-3 text-xs text-white placeholder-[#5a5b60] focus:border-white/25 focus:outline-none font-mono"
                      />
                    </div>
                  </>
                )}

                {modalError && (
                  <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
                    {modalError}
                  </p>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalPlatform(null)}
                    className="h-9 rounded-md border border-white/[0.08] px-3.5 text-xs text-[#a5a6aa] hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex h-9 items-center gap-2 rounded-md bg-[#F4F1E8] px-4 text-xs font-semibold text-[#151515] hover:bg-white disabled:opacity-50 cursor-pointer"
                  >
                    {submitting && <Loader2 size={13} className="animate-spin" />}
                    <span>Save &amp; Verify</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
