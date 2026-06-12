"""Screenshot the new auth pages."""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

PAGES = [
    ("auth-01-signup-role.png",     "http://91.98.144.72:3000/signup", {"width": 1440, "height": 1100}),
    ("auth-02-login.png",           "http://91.98.144.72:3000/login",  {"width": 1440, "height": 900}),
    ("auth-03-header-anon.png",     "http://91.98.144.72:3000/",      {"width": 1440, "height": 200}),
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
                await page.wait_for_timeout(1500)
                await page.screenshot(path=str(OUT / name), full_page=False)
                print(f"  ✓ {name}  ({url})")
            except Exception as e:
                print(f"  ✗ {name}  failed: {e}")
            await ctx.close()
        await browser.close()


asyncio.run(main())
