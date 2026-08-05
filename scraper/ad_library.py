"""
Playwright-based Meta Ad Library scraping.

Meta changes its DOM frequently and blocks datacenter IPs aggressively —
run behind residential proxies in production and expect to maintain the
selectors below. Each ad card is parsed best-effort: missing fields are
returned as None rather than failing the whole scrape.
"""

from __future__ import annotations

import re
from typing import Any
from urllib.parse import quote

from playwright.async_api import async_playwright

AD_LIBRARY_SEARCH = (
    "https://www.facebook.com/ads/library/?active_status=active"
    "&ad_type=all&country=US&q={query}&media_type=all"
)

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)

MAX_ADS = 12


def _build_url(query: str) -> str:
    if query.startswith("http://") or query.startswith("https://"):
        return query
    return AD_LIBRARY_SEARCH.format(query=quote(query))


async def scrape_ad_library(query: str, proxy: str | None = None) -> list[dict[str, Any]]:
    """Scrape up to MAX_ADS ads for a search query or Ad Library URL."""
    url = _build_url(query)

    launch_kwargs: dict[str, Any] = {"headless": True}
    if proxy:
        launch_kwargs["proxy"] = {"server": proxy}

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(**launch_kwargs)
        try:
            context = await browser.new_context(
                user_agent=USER_AGENT,
                viewport={"width": 1440, "height": 900},
                locale="en-US",
            )
            page = await context.new_page()
            await page.goto(url, wait_until="domcontentloaded", timeout=60_000)

            # Let the client-side app render the ad cards.
            await page.wait_for_timeout(5_000)
            for _ in range(3):  # trigger lazy loading
                await page.mouse.wheel(0, 2_000)
                await page.wait_for_timeout(1_500)

            ads = await _extract_ads(page)
            return ads[:MAX_ADS]
        finally:
            await browser.close()


async def _extract_ads(page: Any) -> list[dict[str, Any]]:
    """Pull structured data out of the rendered ad cards."""
    cards = await page.query_selector_all("div[class*='xh8yej3']")
    ads: list[dict[str, Any]] = []

    for card in cards:
        text = (await card.inner_text()) or ""
        if "Library ID" not in text:
            continue

        ad: dict[str, Any] = {
            "meta_ad_id": None,
            "meta_page_name": None,
            "meta_ad_library_url": None,
            "media_type": "image",
            "media_url": None,
            "thumbnail_url": None,
            "ad_copy": None,
            "cta_text": None,
            "landing_page_url": None,
            "metadata": {},
        }

        id_match = re.search(r"Library ID:?\s*(\d+)", text)
        if id_match:
            ad["meta_ad_id"] = id_match.group(1)
            ad["meta_ad_library_url"] = (
                f"https://www.facebook.com/ads/library/?id={id_match.group(1)}"
            )

        started = re.search(r"Started running on\s*([^\n]+)", text)
        if started:
            ad["metadata"]["started_running"] = started.group(1).strip()

        # First strong/link text in the card is typically the page name.
        page_link = await card.query_selector("a[href*='facebook.com/'] span")
        if page_link:
            ad["meta_page_name"] = (await page_link.inner_text()).strip() or None

        video = await card.query_selector("video")
        if video:
            ad["media_type"] = "video"
            ad["media_url"] = await video.get_attribute("src")
            ad["thumbnail_url"] = await video.get_attribute("poster")
        else:
            img = await card.query_selector("img[src*='scontent']")
            if img:
                ad["media_url"] = await img.get_attribute("src")

        # Ad copy: the longest text block that isn't boilerplate.
        lines = [
            line.strip()
            for line in text.split("\n")
            if len(line.strip()) > 30
            and "Library ID" not in line
            and "Started running" not in line
            and "Sponsored" not in line
        ]
        if lines:
            ad["ad_copy"] = max(lines, key=len)

        if ad["media_url"] or ad["ad_copy"]:
            ads.append(ad)

    return ads
