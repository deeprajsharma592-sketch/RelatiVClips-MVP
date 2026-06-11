import pytest
from httpx import ASGITransport, AsyncClient

from backend.main import app


@pytest.mark.asyncio
async def test_contact_success():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/contact",
            json={"email": "test@example.com", "subject": "Hello", "message": "Test message"},
        )
    assert resp.status_code == 200
    assert resp.json() == {"status": "sent"}


@pytest.mark.asyncio
async def test_contact_missing_fields():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/contact",
            json={"email": "test@example.com", "subject": ""},
        )
    assert resp.status_code == 422
