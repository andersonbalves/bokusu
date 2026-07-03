"""Additive /api mirror: clean JSON contracts delegating to domain classes.

Legacy routes stay untouched; only app.py registers these blueprints.
"""

api_blueprints: list = []

from pikaraoke.routes.api.auth import api_auth_bp
from pikaraoke.routes.api.downloads import api_downloads_bp
from pikaraoke.routes.api.files import api_files_bp
from pikaraoke.routes.api.player import api_player_bp
from pikaraoke.routes.api.preferences import api_prefs_bp
from pikaraoke.routes.api.queue import api_queue_bp
from pikaraoke.routes.api.search import api_search_bp
from pikaraoke.routes.api.renamer import api_renamer_bp
from pikaraoke.routes.api.system import api_system_bp

api_blueprints.append(api_auth_bp)
api_blueprints.append(api_prefs_bp)
api_blueprints.append(api_player_bp)
api_blueprints.append(api_queue_bp)
api_blueprints.append(api_search_bp)
api_blueprints.append(api_downloads_bp)
api_blueprints.append(api_files_bp)
api_blueprints.append(api_renamer_bp)
api_blueprints.append(api_system_bp)
