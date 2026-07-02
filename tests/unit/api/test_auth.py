"""Tests for /api/auth."""


def test_get_auth_reports_admin_status(client, admin_client):
    assert client.get("/api/auth").get_json() == {"isAdmin": False}
    assert admin_client.get("/api/auth").get_json() == {"isAdmin": True}


def test_post_auth_correct_password_sets_cookie(client):
    resp = client.post("/api/auth", json={"password": "secret"})
    assert resp.status_code == 200
    assert resp.get_json() == {"isAdmin": True}
    cookie = next(h for h in resp.headers.getlist("Set-Cookie") if h.startswith("admin="))
    assert "admin=secret" in cookie


def test_post_auth_wrong_password_403(client):
    resp = client.post("/api/auth", json={"password": "nope"})
    assert resp.status_code == 403
    assert resp.get_json() == {"error": "Incorrect admin password"}
