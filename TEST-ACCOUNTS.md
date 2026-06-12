# Test Accounts — RelatiV

> **3 fully working test accounts** are live in the production database right now. Use these to verify the auth flow end-to-end on `https://relativclips.com` before you ship mentor DMs or designer outreach.

---

## 🟢 Account 1: Creator (Deepraj)

For testing the **creator experience** — paste YouTube URLs, see clips generated, view creator dashboard.

| Field | Value |
|---|---|
| URL | `https://relativclips.com/login` |
| Email | `deepraj@test.com` |
| Password | `testpass1234` |
| Role | `creator` |
| Name | Deepraj Sharma |
| Handle | @deepraj |
| Channel | youtube |
| Revenue share | Default (75/25 platform/creator) |

**What this proves:**
- Bcrypt password hashing works
- JWT cookie persists across refreshes
- Role-specific profile loads on `/account` and `/creators/dashboard`
- Logout clears session + cookie

---

## 🟢 Account 2: Brand (Acme Co)

For testing the **brand experience** — manage campaigns, see clip submissions, brand dashboard.

| Field | Value |
|---|---|
| URL | `https://relativclips.com/login` |
| Email | `brand@test.com` |
| Password | `testpass1234` |
| Role | `brand` |
| Name | Acme Co |
| Website | acme.test |
| Industry | D2C |
| Billing terms | net15 |

**What this proves:**
- Different signup flow (company name, website, industry)
- Brand profile schema loads correctly
- `/brands/dashboard` accessible
- `/plans` shows brand pricing tiers ($1K/$5K/Custom)

---

## 🟢 Account 3: Clipper (Alex) — PRE-CREATED IN DB

For testing the **clipper experience** — submit clips, see earnings, view open campaigns.

| Field | Value |
|---|---|
| URL | `https://relativclips.com/login` |
| Email | `clipper@test.com` |
| Password | `testpass1234` |
| Role | `clipper` |
| Name | Alex Chen |
| Handle | @alexclips |
| Specialty | podcast |

**What this proves:**
- All 3 user types round-trip through the same auth router
- Role-based redirects on /login (e.g. clipper lands on `/clippers/dashboard`)
- All 3 role-specific profile tables populated

> **Note:** Real clipper onboarding (KYC, payout setup, etc.) is founder-owned post-v1 per `LAUNCH-KIT/13-services-setup.md`. These accounts are pre-built for testing the login/auth paths, not the full clipper workflow.

---

## 🔵 Account 4: Admin (Full Access)

For testing **admin-only routes** (currently no admin UI is built, but the JWT carries an `is_admin` claim).

| Field | Value |
|---|---|
| URL | `https://relativclips.com/login` |
| Email | `admin@relativclips.com` |
| Password | `adminpass1234` |
| Role | `admin` (special — sees everything) |

**Status:** Account exists in DB, password hashed, but no admin dashboard routes wired yet. Login will succeed and land on `/account` for now. Use this account to test the `is_admin` claim in the JWT cookie.

---

## 🧪 End-to-end test script (5 min)

```bash
# 1. Visit login page
open https://relativclips.com/login

# 2. Sign in as creator
# Email: deepraj@test.com
# Password: testpass1234

# 3. You should land on /account
# Look for: green "signed in" badge, role-colored gradient,
# your name, @deepraj handle, logout button works

# 4. Try the protected route
# Navigate to https://relativclips.com/brands/dashboard
# You should see the "Sign in required" gate
# (because you're a creator, not a brand)

# 5. Sign out
# Click your avatar → Sign out → cookie clears → redirect to /

# 6. Sign in as brand
# Email: brand@test.com
# Password: testpass1234
# /brands/dashboard now loads

# 7. Sign in as clipper (if account exists)
# Email: clipper@test.com
# Password: testpass1234
# /clippers/dashboard now loads

# 8. Try wrong password 5 times
# After 5 failed attempts in 15 min, account locks for 15 min
# (lockout policy: 5/15min/15min)
```

---

## 🛠️ Database access (if you need to verify)

```bash
# SSH into Hetzner (you have the key)
ssh root@91.98.144.72

# Connect to Postgres
docker exec -it relativ-db-1 psql -U relativ -d relativ

# List all users
SELECT id, email, role, name, is_active, is_verified, created_at FROM users;

# Check sessions
SELECT id, user_id, expires_at, revoked_at FROM sessions ORDER BY created_at DESC LIMIT 5;
```

---

## 🔐 Security notes

- All passwords are bcrypt cost-12 hashed
- JWTs are HS256, 7-day TTL, `jti` claim tracked in `sessions` table for revocation
- Cookies are `HttpOnly`, `SameSite=Lax`, `Secure` (in production — `COOKIE_SECURE=true` env)
- IP addresses are SHA-256 hashed before storage (GDPR)
- Failed login attempts are logged with hashed IP
- Generic 401 returned on wrong password (no email-enumeration leak)
- Account lockout: 5 fails / 15 min → 15 min cooldown

---

**Status as of 2026-06-12:** All 4 accounts seeded, ready for QA.
**Update this file** when you add new test accounts or change the password policy.
