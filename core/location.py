"""
Reverse geocoding via Nominatim (OpenStreetMap).
Free, no API key required. Rate limit: 1 req/sec.
"""

from __future__ import annotations

import json
import urllib.request
import urllib.parse


_USER_AGENT = "PhotosOrganiser/1.0 (local tool)"


def reverse_geocode(lat: float, lon: float) -> str | None:
    """
    Return a short human-readable location name for (lat, lon), or None.

    Examples: "Llanberis, Wales", "Kyoto, Japan", "Lake District"
    """
    url = (
        "https://nominatim.openstreetmap.org/reverse"
        f"?lat={lat}&lon={lon}&format=json&zoom=10&addressdetails=1"
    )
    req = urllib.request.Request(url, headers={"User-Agent": _USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode())
    except Exception:
        return None

    address = data.get("address", {})

    # Pick the most specific useful name
    place = (
        address.get("village")
        or address.get("suburb")
        or address.get("town")
        or address.get("city")
        or address.get("county")
        or address.get("state_district")
        or address.get("state")
    )
    country = address.get("country")

    if not place and not country:
        return data.get("display_name", "").split(",")[0].strip() or None

    if place and country:
        return f"{place}, {country}"
    return place or country or None
