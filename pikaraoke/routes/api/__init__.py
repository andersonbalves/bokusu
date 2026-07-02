"""Additive /api mirror: clean JSON contracts delegating to domain classes.

Legacy routes stay untouched; only app.py registers these blueprints.
"""

api_blueprints: list = []

from pikaraoke.routes.api.auth import api_auth_bp

api_blueprints.append(api_auth_bp)
