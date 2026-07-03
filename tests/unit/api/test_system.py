"""Tests for /api/system."""

from unittest.mock import patch


def test_info_requires_admin(client):
    assert client.get("/api/system/info").status_code == 403


def test_info_returns_stats(admin_client, fake_karaoke):
    fake_karaoke.youtubedl_version = "2026.01.01"
    data = admin_client.get("/api/system/info").get_json()
    assert set(data) == {
        "cpu",
        "memory",
        "disk",
        "youtubedlVersion",
        "pikaraokeVersion",
    }


def test_library_stats(admin_client, fake_karaoke):
    from unittest.mock import MagicMock
    fake_karaoke.song_manager = MagicMock()
    fake_karaoke.song_manager.songs = ["/x/a.mp4"]
    assert admin_client.get("/api/system/library-stats").get_json() == {"song_count": 1}


def test_sync_library(admin_client, fake_karaoke):
    fake_karaoke.sync_library.return_value = True
    assert admin_client.post("/api/system/sync-library").get_json() == {
        "status": "started"
    }
    fake_karaoke.sync_library.return_value = False
    assert admin_client.post("/api/system/sync-library").get_json() == {
        "status": "already_syncing"
    }


def test_update_ytdl_spawns_thread(admin_client):
    with patch("pikaraoke.routes.api.system.threading.Thread") as thread:
        resp = admin_client.post("/api/system/update-ytdl")
    assert resp.get_json() == {"status": "started"}
    thread.return_value.start.assert_called_once()


def test_reboot_spawns_halt_thread(admin_client):
    with patch("pikaraoke.routes.api.system.threading.Thread") as thread:
        resp = admin_client.post("/api/system/reboot")
    assert resp.get_json() == {"status": "started"}
    thread.assert_called_once()
    assert thread.call_args.kwargs["args"] == [2]


def test_halt_action_unknown(admin_client):
    resp = admin_client.post("/api/system/invalid_action")
    assert resp.status_code == 404
    assert resp.get_json() == {"error": "Unknown action: invalid_action"}
