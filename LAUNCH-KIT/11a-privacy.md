# Privacy Policy — RelatiV

> **For /privacy route. Last updated: 2026-06-12.**
> **This is a v1 template customized for RelatiV. Have a lawyer review before going public with real users.**

---

## 1. What we collect

**Account info:** Email address, name, OAuth profile (if you sign in with Google/GitHub), billing info via Stripe (we never see your card).

**Content you submit:** YouTube URLs, uploaded video files, generated clips, captions, and any text you type in our forms (clipper application, brand contact, etc.).

**Usage data:** IP address, browser type, pages visited, buttons clicked, time spent. We use PostHog (EU-hosted) for this.

**AI processing data:** Transcripts and clip metadata are sent to our AI providers (Anthropic Claude, faster-whisper). We don't send your videos to any third parties for training.

## 2. What we do with it

- Process your videos to generate clips
- Improve the engine (we analyze clip quality, but never the underlying video content)
- Send you product updates (if you opt in)
- Respond to support requests

**We do NOT:**
- Train AI models on your videos or text
- Sell your data to anyone, ever
- Share your content with third parties except the AI providers you've enabled

## 3. How long we keep it

| Data type | Retention | When deleted |
|---|---|---|
| Source video | 24 hours | Auto-deleted after processing |
| Generated clips | 30 days | Auto-deleted unless you download |
| Transcripts | 90 days | Auto-deleted |
| Account info | Until you delete account | On account deletion request |
| Billing info | 7 years (tax law) | On Stripe's schedule, not ours |
| Usage analytics | 24 months | Auto-anonymized after that |

## 4. Where it's stored

**EU (Hetzner Falkenstein, Germany)** for production data. **US (Hetzner Ashburn)** for backups. **EU PostHog** for analytics. We are GDPR compliant by design.

If you're a US user, your data may be transferred to the EU for processing. We use Standard Contractual Clauses (SCCs) for the transfer.

## 5. Your rights

- **Access:** Request a copy of all data we have on you
- **Delete:** Request deletion of your account and all associated data
- **Export:** Download your clips, transcripts, and account info as a ZIP
- **Rectify:** Update any inaccurate account info
- **Object:** Opt out of marketing emails (1-click unsubscribe in every email)
- **Restrict:** Pause processing of your data without deleting your account

Email **privacy@relativ.app** for any of these. Response within 7 days.

## 6. Cookies

We use 4 cookies:
- **session** — for authentication (essential, can't be opted out)
- **preferences** — saves your clipper-section toggle, theme (optional)
- **analytics** — PostHog session recording (optional, opt out via cookie banner)
- **csrf** — prevents form forgery (essential)

## 7. Third-party services

| Service | Purpose | Data shared |
|---|---|---|
| Anthropic (Claude) | Hook scoring | Transcripts only (no video) |
| Hetzner | Hosting | All data, EU-stored |
| Stripe | Billing | Card info (we never see) |
| PostHog | Analytics | Anonymized usage events |
| bgutil | YouTube PO tokens | URLs only |
| YouTube | Source content (via user URL) | URL + metadata only |

## 8. Children

RelatiV is not for users under 16. We don't knowingly collect data from minors. If we discover a minor's data, we delete it within 7 days.

## 9. Security

- TLS 1.3 everywhere
- Encrypted at rest (AES-256)
- 2FA on all internal accounts
- Annual third-party security audit (scheduled)
- Bug bounty program (planned for v1.1)

## 10. Changes to this policy

We email all users 30 days before any material change. Last updated 2026-06-12.

## 11. Contact

- **Data Protection Officer:** dpo@relativ.app
- **General privacy:** privacy@relativ.app
- **Postal address:** RelatiV, c/o [Registered Agent], India

For EU users: you can also file a complaint with your local data protection authority.
