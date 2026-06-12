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

# Pages: (name, path, viewport, scroll_to_y for section view)
# scroll_to_y is the Y position to scroll to BEFORE taking a viewport
# screenshot (None = full page from top). Y values were measured from
# a live page on the Hetzner deploy.
PAGES = [
    ("01-landing-hero", "/", {"width": 1440, "height": 900}, 0),
    ("02-landing-demo", "/", {"width": 1440, "height": 900}, 1100),
    ("03-landing-engine", "/", {"width": 1440, "height": 900}, 2400),
    ("04-landing-verticals", "/", {"width": 1440, "height": 900}, 3400),
    ("05-landing-pricing", "/", {"width": 1440, "height": 900}, 4250),
    ("06-landing-cta", "/", {"width": 1440, "height": 900}, 5100),
    # Full pages of the other routes
    ("07-clippers", "/clippers", {"width": 1440, "height": 900}, None),
    ("08-apply", "/clippers/apply", {"width": 1440, "height": 900}, None),
    ("09-brands", "/brands", {"width": 1440, "height": 900}, None),
    # Mobile views
    ("10-landing-mobile", "/", {"width": 390, "height": 844}, None),
    ("11-clippers-mobile", "/clippers", {"width": 390, "height": 844}, None),
    # A "social card" size for the OG image
    ("12-og-1200x630", "/", {"width": 1200, "height": 630}, 0),
]

OUT_DIR = Path("/app/RelatiV/screenshots")
OUT_DIR.mkdir(parents=True, exist_ok=True)


async def warmup_animations(page, total_height: int, viewport_h: int):
    """Scroll through the page so framer-motion `whileInView` fires for
    every section. The full_page screenshot itself doesn't trigger
    in-view animations — they only fire when content enters the
    actual viewport, not the rendered output area."""
    step = max(300, viewport_h // 2)
    y = 0
    while y < total_height:
        await page.evaluate(f"window.scrollTo(0, {y})")
        await page.wait_for_timeout(200)
        y += step
    # Pause at the bottom for the last batch of animations
    await page.evaluate(f"window.scrollTo(0, {total_height})")
    await page.wait_for_timeout(400)


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--no-sandbox"])
        for name, path, viewport, scroll_y in PAGES:
            ctx = await browser.new_context(
                viewport=viewport,
                device_scale_factor=1,
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                           "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            )
            page = await ctx.new_page()
            url = f"http://127.0.0.1:3000{path}"
            print(f"[screenshot] {name} ← {url} @ {viewport['width']}x{viewport['height']} (scroll={scroll_y})")
            try:
                await page.goto(url, wait_until="networkidle", timeout=30000)
                # Wait for fonts + images to settle
                await page.wait_for_timeout(1500)
                # Warm up framer-motion animations across the whole page
                height = await page.evaluate("document.body.scrollHeight")
                await warmup_animations(page, height, viewport["height"])
                # Now position the viewport for the desired section
                if scroll_y is not None:
                    await page.evaluate(f"window.scrollTo(0, {scroll_y})")
                    await page.wait_for_timeout(600)
                    out = OUT_DIR / f"{name}.png"
                    await page.screenshot(path=str(out), full_page=False)
                else:
                    # Full-page shot from the top
                    await page.evaluate("window.scrollTo(0, 0)")
                    await page.wait_for_timeout(600)
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
