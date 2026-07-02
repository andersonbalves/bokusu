"""Shared helpers for the /api mirror blueprints."""

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
