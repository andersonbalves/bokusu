"""Tests for the /api scaffold: blueprint registry and admin guard."""


def test_api_blueprints_list_exists():
    from pikaraoke.routes.api import api_blueprints

    assert isinstance(api_blueprints, list)


def test_require_admin_blocks_without_cookie(client):
    resp = client.get("/api/_test_admin")
    assert resp.status_code == 403
    assert resp.get_json() == {"error": "Unauthorized"}


def test_require_admin_allows_with_cookie(admin_client):
    resp = admin_client.get("/api/_test_admin")
    assert resp.status_code == 200
