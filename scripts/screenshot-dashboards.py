"""
Screenshot the new Path A pages for the founder.
Saves to /app/RelatiV/screenshots/dashboards-*.png
"""

import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

PAGES = [
    ("dashboards-01-brand.png",     "http://91.98.144.72:3000/brands/dashboard",   {"width": 1440, "height": 1100}),
    ("dashboards-02-clipper.png",   "http://91.98.144.72:3000/clippers/dashboard", {"width": 1440, "height": 1100}),
    ("dashboards-03-campaigns.png", "http://91.98.144.72:3000/campaigns",          {"width": 1440, "height": 1100}),
    ("dashboards-04-plans.png",     "http://91.98.144.72:3000/plans",              {"width": 1440, "height": 1100}),
]

OUT = Path("/app/RelatiV/screenshots")
OUT.mkdir(exist_ok=True, parents=True)


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        for name, url, viewport in PAGES:
            ctx = await browser.new_context(viewport=viewport, device_scale_factor=1)
            page = await ctx.new_page()
            try:
                await page.goto(url, wait_until="networkidle", timeout=30000)
                # Let any whileInView or fade-in animations finish
                await page.wait_for_timeout(1500)
                # Scroll through to trigger framer-motion whileInView
                await page.evaluate("""
                    async () => {
                        const h = document.body.scrollHeight;
                        for (let y = 0; y < h; y += 600) {
                            window.scrollTo(0, y);
                            await new Promise(r => setTimeout(r, 80));
                        }
                        window.scrollTo(0, 0);
                        await new Promise(r => setTimeout(r, 200));
                    }
                """)
                await page.wait_for_timeout(500)
                await page.screenshot(path=str(OUT / name), full_page=False)
                print(f"  ✓ {name}  ({url})")
            except Exception as e:
                print(f"  ✗ {name}  failed: {e}")
            await ctx.close()
        await browser.close()


asyncio.run(main())
