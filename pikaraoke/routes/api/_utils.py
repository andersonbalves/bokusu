"""Shared helpers for the /api mirror blueprints."""

import re
import unicodedata
from collections.abc import Callable
from functools import wraps
from typing import Any

from flask import jsonify

from pikaraoke.lib.current_app import is_admin


def require_admin(fn: Callable[..., Any]) -> Callable[..., Any]:
    """Return 403 JSON when the request lacks the admin cookie."""

    @wraps(fn)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        if not is_admin():
            return jsonify({"error": "Unauthorized"}), 403
        return fn(*args, **kwargs)

    return wrapper


def normalize_name_for_comparison(name: str) -> str:
    """Normalize for comparison: unify dashes, whitespace, case, and diacritics."""
    if not name:
        return ""
    name = re.sub(r"[-\u2013\u2014\u2212]", "-", name)
    name = re.sub(r"\s+", " ", name.strip())
    return unicodedata.normalize("NFD", name).encode("ascii", "ignore").decode("ascii").lower()


def names_match(name: str, correct_name: str | None) -> bool:
    """Check if a song name and its corrected version are effectively identical."""
    normalized_name = normalize_name_for_comparison(name)
    normalized_correct = normalize_name_for_comparison(correct_name or "")
    return normalized_name == normalized_correct
