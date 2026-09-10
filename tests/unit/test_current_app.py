"""Tests for admin cookie signing in pikaraoke.lib.current_app."""

from unittest.mock import patch

import pytest
from flask import Flask

import pikaraoke.lib.current_app as current_app_module
from pikaraoke.lib.current_app import _get_persisted_secret_key, admin_cookie_value, is_admin


@pytest.fixture
def app():
    app = Flask(__name__)
    app.secret_key = "test-secret"
    return app


def _request_ctx(app, admin_cookie: str | None = None):
    headers = {"Cookie": f"admin={admin_cookie}"} if admin_cookie is not None else {}
    return app.test_request_context("/", headers=headers)


def test_roundtrip_valid_token_is_admin(app):
    token = admin_cookie_value("pw", app)
    with patch("pikaraoke.lib.current_app.get_admin_password", return_value="pw"):
        with _request_ctx(app, token):
            assert is_admin() is True


def test_wrong_password_token_is_not_admin(app):
    token = admin_cookie_value("other", app)
    with patch("pikaraoke.lib.current_app.get_admin_password", return_value="pw"):
        with _request_ctx(app, token):
            assert is_admin() is False


def test_plaintext_password_cookie_is_not_admin(app):
    with patch("pikaraoke.lib.current_app.get_admin_password", return_value="pw"):
        with _request_ctx(app, "pw"):
            assert is_admin() is False


def test_no_cookie_is_not_admin(app):
    with patch("pikaraoke.lib.current_app.get_admin_password", return_value="pw"):
        with _request_ctx(app):
            assert is_admin() is False


def test_no_password_configured_is_admin_regardless_of_cookie(app):
    with patch("pikaraoke.lib.current_app.get_admin_password", return_value=None):
        with _request_ctx(app, "garbage"):
            assert is_admin() is True


def test_tampered_token_is_not_admin(app):
    token = admin_cookie_value("pw", app)
    bad_token = token[:5] + ("X" if token[5] != "X" else "Y") + token[6:]
    with patch("pikaraoke.lib.current_app.get_admin_password", return_value="pw"):
        with _request_ctx(app, bad_token):
            assert is_admin() is False


def test_admin_cookie_value_uses_current_app_fallback(app):
    with app.app_context():
        token = admin_cookie_value("pw")
    with patch("pikaraoke.lib.current_app.get_admin_password", return_value="pw"):
        with _request_ctx(app, token):
            assert is_admin() is True


def test_get_persisted_secret_key_creates_once_with_private_mode(tmp_path, monkeypatch):
    monkeypatch.setattr(current_app_module, "get_data_directory", lambda: str(tmp_path))
    key = _get_persisted_secret_key()
    assert key == _get_persisted_secret_key()
    assert len(key) == 48  # os.urandom(24).hex()
    assert (tmp_path / ".secret_key").stat().st_mode & 0o777 == 0o600
