#!/usr/bin/env python3
"""Refresh Yilan County museum entries from the Ministry of Culture open-data API.

This script only manages entries whose source_url matches MUSEUM_API_URL.
All other entries in data/resources.json (manually curated: libraries, DOCs,
youth/volunteer platforms, education indicators, non-museum culture sites)
are left untouched.

Run: python scripts/update_museums.py
Exits with status 1 if the fetch fails, so a CI job can distinguish
"no changes" (silent) from "could not reach the source" (should fail loudly).
"""
import json
import sys
import time
import urllib.request
from datetime import date, timezone
from pathlib import Path

MUSEUM_API_URL = "https://cloud.culture.tw/frontsite/trans/emapOpenDataAction.do?method=exportEmapJson&typeId=H"
TARGET_CITY = "宜蘭縣"
ROOT = Path(__file__).resolve().parent.parent
RESOURCES_PATH = ROOT / "data" / "resources.json"

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
    "Referer": "https://cloud.culture.tw/",
}


def fetch_museums(attempts=3, timeout=60):
    last_err = None
    for i in range(attempts):
        try:
            req = urllib.request.Request(MUSEUM_API_URL, headers=REQUEST_HEADERS)
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read().decode("utf-8-sig")
            return json.loads(raw)
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            if i < attempts - 1:
                time.sleep(5 * (i + 1))
    raise last_err


def to_resource(entry, today):
    pk = entry.get("mainTypePk", "")[:8] or "unknown"
    lat = entry.get("latitude")
    lng = entry.get("longitude")
    try:
        lat = float(lat) if lat not in (None, "") else None
        lng = float(lng) if lng not in (None, "") else None
    except ValueError:
        lat, lng = None, None

    return {
        "id": f"CUL-M-{pk}",
        "name": entry.get("name", "").strip(),
        "category": "culture",
        "township": None,  # filled in by caller once address parsing is confirmed manually
        "address": entry.get("address") or None,
        "lat": lat,
        "lng": lng,
        "geocode_status": "official" if lat is not None else "no_address",
        "description": (entry.get("type") or "") + "／" + (entry.get("mainTypeName") or ""),
        "source_org": "文化部",
        "source_url": MUSEUM_API_URL,
        "last_verified": today,
        "confidence": "high",
    }


def main():
    today = date.today().isoformat()

    try:
        museums = fetch_museums()
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: failed to fetch museum API: {exc}", file=sys.stderr)
        sys.exit(1)

    yilan = [m for m in museums if m.get("cityName") == TARGET_CITY]
    if not yilan:
        print("ERROR: fetched museum list but found zero 宜蘭縣 entries — "
              "likely an API shape change, refusing to overwrite existing data.", file=sys.stderr)
        sys.exit(1)

    resources = json.loads(RESOURCES_PATH.read_text(encoding="utf-8"))

    # township is not provided by this API in a clean form; keep whatever a
    # human previously assigned for the same museum name, default to None
    # (needs manual fix-up) for genuinely new entries.
    existing_township_by_name = {
        r["name"]: r["township"] for r in resources if r.get("source_url") == MUSEUM_API_URL
    }

    fresh = []
    for m in yilan:
        r = to_resource(m, today)
        r["township"] = existing_township_by_name.get(r["name"])
        fresh.append(r)

    unmanaged = [r for r in resources if r.get("source_url") != MUSEUM_API_URL]
    updated = unmanaged + fresh

    missing_township = [r["name"] for r in fresh if not r["township"]]
    if missing_township:
        print("NOTE: these museum entries have no township assigned yet, "
              "needs a human to fill in data/resources.json manually: "
              + ", ".join(missing_township))

    before_ids = {r["id"] for r in resources if r.get("source_url") == MUSEUM_API_URL}
    after_ids = {r["id"] for r in fresh}
    added = after_ids - before_ids
    removed = before_ids - after_ids

    if not added and not removed:
        print("No change in Yilan museum entries.")
    else:
        print(f"Museum entries changed: +{len(added)} -{len(removed)}")

    RESOURCES_PATH.write_text(
        json.dumps(updated, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
