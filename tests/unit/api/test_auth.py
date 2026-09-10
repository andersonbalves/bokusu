"""Tests for /api/auth."""

from pikaraoke.lib.current_app import admin_cookie_value


def test_get_auth_reports_admin_status(client, admin_client):
    assert client.get("/api/auth").get_json() == {"isAdmin": False}
    assert admin_client.get("/api/auth").get_json() == {"isAdmin": True}


def test_post_auth_correct_password_sets_cookie(client):
    resp = client.post("/api/auth", json={"password": "secret"})
    assert resp.status_code == 200
    assert resp.get_json() == {"isAdmin": True}
    cookie = next(h for h in resp.headers.getlist("Set-Cookie") if h.startswith("admin="))
    assert "admin=secret" not in cookie
    assert len(cookie.split(".")[1]) > 0  # signed token, not the plaintext password


def test_post_auth_wrong_password_403(client):
    resp = client.post("/api/auth", json={"password": "nope"})
    assert resp.status_code == 403
    assert resp.get_json() == {"error": "Incorrect admin password"}


def test_login_does_not_set_plaintext_cookie(client):
    resp = client.post("/api/auth", json={"password": "secret"})
    assert resp.status_code == 200
    assert "secret" not in resp.headers.getlist("Set-Cookie")


def test_signed_cookie_grants_admin(app, client):
    client.set_cookie("admin", admin_cookie_value("secret", app))
    assert client.get("/api/auth").get_json() == {"isAdmin": True}


def test_plaintext_password_cookie_rejected(client):
    client.set_cookie("admin", "secret")
    assert client.get("/api/auth").get_json() == {"isAdmin": False}
