"""
Meta Ad Library scraper service.

Receives scrape jobs from the Next.js app, scrapes the Meta Ad Library
with Playwright (optionally through residential proxies), and posts the
results back to the app's callback endpoint.

Environment variables:
    SCRAPER_API_KEY   Shared secret; must match the Next.js app.
    PROXY_SERVER      Optional, e.g. http://user:pass@proxy.example.com:8000
"""

import asyncio
import logging
import os

import httpx
from fastapi import BackgroundTasks, FastAPI, Header, HTTPException
from pydantic import BaseModel

from ad_library import scrape_ad_library

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("scraper")

API_KEY = os.environ.get("SCRAPER_API_KEY", "")

app = FastAPI(title="Meta Ad Library Scraper")


class ScrapeRequest(BaseModel):
    job_id: str
    user_id: str
    query: str
    callback_url: str


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/scrape")
async def scrape(
    req: ScrapeRequest,
    background_tasks: BackgroundTasks,
    x_api_key: str = Header(default=""),
) -> dict:
    if not API_KEY or x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")

    background_tasks.add_task(run_job, req)
    return {"accepted": True, "job_id": req.job_id}


async def run_job(req: ScrapeRequest) -> None:
    """Scrape and post results back to the app. Never raises."""
    payload: dict
    try:
        ads = await asyncio.wait_for(
            scrape_ad_library(req.query, proxy=os.environ.get("PROXY_SERVER")),
            timeout=180,
        )
        payload = {
            "job_id": req.job_id,
            "user_id": req.user_id,
            "status": "completed",
            "ads": ads,
        }
        logger.info("job %s scraped %d ads", req.job_id, len(ads))
    except Exception as exc:  # noqa: BLE001 — report every failure to the app
        logger.exception("job %s failed", req.job_id)
        payload = {
            "job_id": req.job_id,
            "user_id": req.user_id,
            "status": "failed",
            "error": str(exc)[:500],
            "ads": [],
        }

    async with httpx.AsyncClient(timeout=120) as client:
        for attempt in range(3):
            try:
                res = await client.post(
                    req.callback_url,
                    json=payload,
                    headers={"X-API-Key": API_KEY},
                )
                res.raise_for_status()
                return
            except Exception:  # noqa: BLE001
                logger.warning(
                    "callback attempt %d failed for job %s", attempt + 1, req.job_id
                )
                await asyncio.sleep(2**attempt)
        logger.error("all callback attempts failed for job %s", req.job_id)
