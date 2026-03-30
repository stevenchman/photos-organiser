"""
Claude AI vision integration for suggesting descriptive folder names.
"""

from __future__ import annotations

import base64
import io
from datetime import date
from pathlib import Path

from PIL import Image

from config import AI_SAMPLE_MAX_SIZE


class AIVisionError(Exception):
    """Raised when the Claude API call fails."""


def suggest_group_name(
    sample_image_path: Path,
    capture_date: date,
    api_key: str,
) -> str:
    """
    Send a resized sample image to Claude and get a short folder name suggestion.

    Returns a 2-5 word description string (no date prefix).
    Raises AIVisionError on any failure.
    """
    import anthropic

    image_b64 = _prepare_image(sample_image_path)

    client = anthropic.Anthropic(api_key=api_key)
    try:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=64,
            system=(
                "You are a photo organiser assistant. "
                "Given a photo, suggest a short descriptive folder name "
                "that captures the main subject, location, or activity. "
                "Use 2 to 5 words, title case, no punctuation, no date. "
                "Return only the folder name, nothing else."
            ),
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": image_b64,
                            },
                        },
                        {
                            "type": "text",
                            "text": f"Suggest a folder name for this photo taken on {capture_date.strftime('%d %B %Y')}.",
                        },
                    ],
                }
            ],
        )
        name = response.content[0].text.strip()
        # Strip any accidental quotes or punctuation Claude might add
        name = name.strip("\"'.,;:")
        return name
    except anthropic.AuthenticationError:
        raise AIVisionError("Invalid API key.")
    except anthropic.RateLimitError:
        raise AIVisionError("Rate limit reached. Try again shortly.")
    except Exception as exc:
        raise AIVisionError(str(exc)) from exc


def validate_api_key(api_key: str) -> bool:
    """Make a cheap test call to verify the key works. Returns True if valid."""
    import anthropic
    try:
        client = anthropic.Anthropic(api_key=api_key)
        client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1,
            messages=[{"role": "user", "content": "hi"}],
        )
        return True
    except anthropic.AuthenticationError:
        return False
    except Exception:
        # Network errors etc. — treat as unknown, not invalid
        return True


def _prepare_image(image_path: Path) -> str:
    """Open image, resize to AI_SAMPLE_MAX_SIZE, return base64 JPEG string."""
    try:
        img = Image.open(image_path)
        img.thumbnail(AI_SAMPLE_MAX_SIZE, Image.LANCZOS)
        if img.mode in ("RGBA", "P", "CMYK"):
            img = img.convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=80)
        return base64.standard_b64encode(buf.getvalue()).decode()
    except Exception as exc:
        raise AIVisionError(f"Could not prepare image: {exc}") from exc
