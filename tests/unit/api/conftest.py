"""Shared fixtures for /api route tests."""

from unittest.mock import MagicMock

import pytest
from flask import Flask
from flask_smorest import Api

from pikaraoke.lib.preference_manager import PreferenceManager


@pytest.fixture
def fake_karaoke(tmp_path):
    """Karaoke fake: PreferenceManager real (leve), resto MagicMock."""
    from pikaraoke.karaoke import Karaoke
    from pikaraoke.lib.playback_controller import PlaybackController

    from pikaraoke.lib.queue_manager import QueueManager

    k = MagicMock(spec=Karaoke)
    k.preferences = PreferenceManager(config_file_path=str(tmp_path / "config.ini"))
    k.volume = 0.85
    k.playback_controller = MagicMock(spec=PlaybackController)
    k.playback_controller.now_playing_transpose = 0
    k.playback_controller.is_paused = False
    k.queue_manager = MagicMock(spec=QueueManager)
    k.queue_manager._events = MagicMock()
    return k


@pytest.fixture
def app(fake_karaoke):
    app = Flask(__name__)
    app.secret_key = "test"
    app.config["API_TITLE"] = "test"
    app.config["API_VERSION"] = "0"
    app.config["OPENAPI_VERSION"] = "3.0.2"
    app.config["KARAOKE_INSTANCE"] = fake_karaoke
    app.config["ADMIN_PASSWORD"] = "secret"
    app.config["SITE_NAME"] = "PiKaraoke"
    from flask_babel import Babel

    Babel(app)
    api = Api(app)

    from pikaraoke.routes.api import api_blueprints

    for bp in api_blueprints:
        api.register_blueprint(bp)

    # Rota sentinela para testar o decorator isoladamente
    from pikaraoke.routes.api._utils import require_admin

    @app.route("/api/_test_admin")
    @require_admin
    def _test_admin():
        return {"ok": True}

    return app


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def admin_client(app):
    c = app.test_client()
    c.set_cookie("admin", "secret")
    return c
