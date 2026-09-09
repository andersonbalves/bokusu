"""Tests for legacy admin /auth route (open-redirect guard)."""

import pytest
from flask import Flask
from flask_babel import Babel


@pytest.fixture
def app():
    app = Flask(__name__)
    app.secret_key = "test"
    app.config["ADMIN_PASSWORD"] = "secret"
    app.config["SITE_NAME"] = "PiKaraoke"
    Babel(app)
    from pikaraoke.routes.admin import admin_bp

    app.register_blueprint(admin_bp)
    return app


@pytest.fixture
def client(app):
    return app.test_client()


def test_auth_rejects_protocol_relative_next_url(client):
    resp = client.post("/auth", data={"admin_password": "secret", "next": "//evil.com"})
    assert resp.status_code == 302
    assert resp.headers["Location"] == "/"


def test_auth_keeps_safe_relative_next_url(client):
    resp = client.post("/auth", data={"admin_password": "secret", "next": "/queue"})
    assert resp.status_code == 302
    assert resp.headers["Location"] == "/queue"
