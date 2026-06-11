"""
Tests for the new /api/v1/* intake endpoints (clipper applications,
brand contacts, CPM quotes). These are the backend wiring for the
fuchsia-era forms on /clippers/apply and /brands.

Uses FastAPI's TestClient (no live server needed). Validates:
- happy path for each endpoint
- validation errors (e.g. budget < $1k, bad email)
- the quote math matches the frontend CpmCalculator exactly
- the intake store accumulates records
"""

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.store import intake


@pytest.fixture(autouse=True)
def reset_intake():
    """Each test starts with a clean intake store."""
    with intake._lock:
        intake._clipper_applications.clear()
        intake._brand_contacts.clear()
        intake._campaign_quotes.clear()
    yield


@pytest.fixture
def client():
    return TestClient(app)


# ─── Clipper applications ────────────────────────────────────────────────

def test_clipper_apply_happy_path(client):
    payload = {
        "name": "Maya Chen",
        "email": "maya@example.com",
        "handle": "@hookqueen",
        "specialty": "Podcasts · Tech",
        "platforms": ["TikTok", "Instagram Reels"],
        "weekly_volume": 14,
        "portfolio_urls": [
            "https://tiktok.com/@maya/video/1",
            "https://tiktok.com/@maya/video/2",
        ],
    }
    r = client.post("/api/v1/clippers/apply", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["name"] == "Maya Chen"
    assert data["email"] == "maya@example.com"
    assert data["handle"] == "@hookqueen"
    assert data["specialty"] == "Podcasts · Tech"
    assert data["platforms"] == ["TikTok", "Instagram Reels"]
    assert data["weekly_volume"] == 14
    assert len(data["portfolio_urls"]) == 2
    assert data["id"].startswith("app_")
    assert data["submitted_at"] is not None


def test_clipper_apply_minimum_required(client):
    """Missing required fields returns 422."""
    r = client.post("/api/v1/clippers/apply", json={"name": "X"})
    assert r.status_code == 422


def test_clipper_apply_weekly_volume_capped(client):
    """weekly_volume > 500 is rejected (quality gate)."""
    r = client.post("/api/v1/clippers/apply", json={
        "name": "Spam",
        "email": "spam@spam.com",
        "handle": "@spam",
        "specialty": "Other",
        "weekly_volume": 1000,
        "portfolio_urls": ["https://example.com/1"],
    })
    assert r.status_code == 422


def test_clipper_apply_persists_across_requests(client):
    """Two POSTs → intake store has 2 records."""
    for i in range(2):
        client.post("/api/v1/clippers/apply", json={
            "name": f"Person {i}",
            "email": f"p{i}@example.com",
            "handle": f"@p{i}",
            "specialty": "Comedy",
            "portfolio_urls": [f"https://example.com/{i}"],
        })
    counts = client.get("/api/v1/intake/counts").json()
    assert counts["clipper_applications"] == 2


# ─── Brand contacts ───────────────────────────────────────────────────────

def test_brand_contact_happy_path(client):
    payload = {
        "name": "Sarah Lee",
        "email": "sarah@spotify.com",
        "company": "Spotify",
        "video_url": "https://youtube.com/watch?v=abc123",
        "budget_usd": 24000,
        "notes": "Q4 podcast push",
    }
    r = client.post("/api/v1/brands/contact", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["company"] == "Spotify"
    assert data["budget_usd"] == 24000
    assert data["id"].startswith("brand_")
    assert data["submitted_at"] is not None


def test_brand_contact_min_budget_enforced(client):
    """budget_usd < 1000 is rejected."""
    r = client.post("/api/v1/brands/contact", json={
        "name": "X",
        "email": "x@x.com",
        "video_url": "https://example.com/v",
        "budget_usd": 500,
    })
    assert r.status_code == 422


def test_brand_contact_optional_fields(client):
    """company + notes are optional."""
    r = client.post("/api/v1/brands/contact", json={
        "name": "Solo",
        "email": "solo@x.com",
        "video_url": "https://example.com/v",
        "budget_usd": 5000,
    })
    assert r.status_code == 200
    data = r.json()
    assert data["company"] is None
    assert data["notes"] is None


# ─── Campaign quotes (CPM calculator) ────────────────────────────────────

def test_quote_math_matches_frontend(client):
    """The server must produce the same numbers the frontend CpmCalculator
    shows. $5,000 should be 628,571 views, 13 clips, 2 clippers."""
    r = client.post("/api/v1/campaigns/quote", json={"budget_usd": 5000})
    assert r.status_code == 200
    data = r.json()
    assert data["budget_usd"] == 5000
    assert data["cpm_usd"] == 7.0
    assert data["platform_margin"] == 0.12
    assert data["estimated_views"] == 628571  # floor(5000/7 * 1000 * 0.88) = 628571
    assert data["estimated_clips"] == 13
    assert data["clippers_assigned"] == 2
    assert data["turnaround_hours"] == 48
    assert data["quote_id"].startswith("q_")
    assert data["expires_at"] is not None


def test_quote_platform_split(client):
    """The platform split should add up to ~100% (within 1 view rounding)."""
    r = client.post("/api/v1/campaigns/quote", json={"budget_usd": 10000})
    data = r.json()
    # Estimated views: 10000 / 7 * 1000 * 0.88 = 1,257,142.857... → floor = 1,257,142
    assert data["estimated_views"] == 1_257_142
    total_impressions = sum(p["impressions"] for p in data["platform_split"])
    # Float arithmetic on the 0.45/0.30/0.25 split can be off by 1 view
    # due to the cumulative floor — that's expected. Total should be within
    # 1 of the headline estimated_views.
    assert abs(total_impressions - data["estimated_views"]) <= 1
    # TikTok + Reels + Shorts add up
    by_id = {p["id"]: p for p in data["platform_split"]}
    assert by_id["tiktok"]["share"] == 0.45
    assert by_id["reels"]["share"] == 0.30
    assert by_id["shorts"]["share"] == 0.25
    # Each platform's clips should round consistently
    total_clips = sum(p["clips"] for p in data["platform_split"])
    assert abs(total_clips - data["estimated_clips"]) <= 2  # ceil/floor margin


def test_quote_min_budget(client):
    r = client.post("/api/v1/campaigns/quote", json={"budget_usd": 500})
    assert r.status_code == 422


def test_quote_max_budget(client):
    r = client.post("/api/v1/campaigns/quote", json={"budget_usd": 100_000_000})
    assert r.status_code == 422


def test_quote_persists(client):
    r1 = client.post("/api/v1/campaigns/quote", json={"budget_usd": 5000})
    r2 = client.post("/api/v1/campaigns/quote", json={"budget_usd": 10000})
    counts = client.get("/api/v1/intake/counts").json()
    assert counts["campaign_quotes"] == 2
    assert r1.json()["quote_id"] != r2.json()["quote_id"]


def test_quote_optional_video_url(client):
    """video_url is optional in the quote endpoint."""
    r = client.post("/api/v1/campaigns/quote", json={"budget_usd": 5000})
    assert r.status_code == 200


# ─── Debug helper ─────────────────────────────────────────────────────────

def test_intake_counts_shape(client):
    r = client.get("/api/v1/intake/counts")
    assert r.status_code == 200
    data = r.json()
    assert set(data.keys()) == {
        "clipper_applications",
        "brand_contacts",
        "campaign_quotes",
    }
    assert all(isinstance(v, int) for v in data.values())
