"""
Take screenshots of the live RelatiV frontend for the launch kit.

Saves PNG files to /app/RelatiV/screenshots/ on the Hetzner server.
Run via:
    cd /app/RelatiV && source backend/.venv/bin/activate && \
    python -m backend.scripts.take_screenshots
"""
import asyncio
from pathlib import Path

from playwright.async_api import async_playwright

PAGES = [
    ("01-landing", "/", {"width": 1440, "height": 900}),
    ("02-clippers", "/clippers", {"width": 1440, "height": 900}),
    ("03-apply", "/clippers/apply", {"width": 1440, "height": 900}),
    ("04-brands", "/brands", {"width": 1440, "height": 900}),
    # Mobile versions of the key pages (for social share images)
    ("05-landing-mobile", "/", {"width": 390, "height": 844}),
    ("06-clippers-mobile", "/clippers", {"width": 390, "height": 844}),
]

OUT_DIR = Path("/app/RelatiV/screenshots")
OUT_DIR.mkdir(parents=True, exist_ok=True)


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--no-sandbox"])
        for name, path, viewport in PAGES:
            ctx = await browser.new_context(
                viewport=viewport,
                device_scale_factor=1,
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                           "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            )
            page = await ctx.new_page()
            url = f"http://127.0.0.1:3000{path}"
            print(f"[screenshot] {name} ← {url} @ {viewport['width']}x{viewport['height']}")
            try:
                await page.goto(url, wait_until="networkidle", timeout=30000)
                # Wait for fonts + images to settle
                await page.wait_for_timeout(1500)
                out = OUT_DIR / f"{name}.png"
                await page.screenshot(path=str(out), full_page=True)
                size_kb = out.stat().st_size // 1024
                print(f"  ✓ saved {out.name} ({size_kb} KB)")
            except Exception as e:
                print(f"  ✗ failed: {e}")
            await ctx.close()
        await browser.close()
    print(f"\nDone. {len(PAGES)} screenshots in {OUT_DIR}")


if __name__ == "__main__":
    asyncio.run(main())
