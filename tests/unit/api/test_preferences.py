"""Tests for /api/preferences."""

from unittest.mock import patch


def test_get_preferences_returns_all(client, fake_karaoke):
    resp = client.get("/api/preferences")
    assert resp.status_code == 200
    data = resp.get_json()
    assert "volume" in data
    assert "splash_display_mode" in data


def test_put_preference_requires_admin(client):
    assert client.put("/api/preferences/volume", json={"value": 0.5}).status_code == 403


@patch("pikaraoke.routes.api.preferences.broadcast_event")
def test_put_preference_updates_value(mock_broadcast, admin_client, fake_karaoke):
    resp = admin_client.put("/api/preferences/volume", json={"value": 0.5})
    assert resp.status_code == 200
    json_data = resp.get_json()
    assert json_data["success"] is True
    assert "changed successfully" in json_data["message"]
    assert fake_karaoke.preferences.get("volume") == 0.5
    mock_broadcast.assert_called_once_with("preferences_update", {"key": "volume", "value": 0.5})


def test_put_preference_unknown_key(admin_client):
    resp = admin_client.put("/api/preferences/unknown_invalid_key", json={"value": "foo"})
    assert resp.status_code == 404
    assert resp.get_json() == {"error": "Unknown preference"}


@patch("pikaraoke.routes.api.preferences.broadcast_event")
def test_delete_preferences_restores_defaults(mock_broadcast, admin_client, fake_karaoke):
    fake_karaoke.preferences.set("volume", 0.5)
    resp = admin_client.delete("/api/preferences")
    assert resp.status_code == 200
    json_data = resp.get_json()
    assert json_data["success"] is True
    assert fake_karaoke.preferences.get("volume") != 0.5  # restaurado
    from pikaraoke.lib.preference_manager import PreferenceManager

    mock_broadcast.assert_any_call("preferences_reset", PreferenceManager.DEFAULTS)
