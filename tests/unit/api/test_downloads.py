"""Tests for /api/downloads."""

from unittest.mock import MagicMock


def test_post_download_queues(client, fake_karaoke):
    fake_karaoke.download_manager = MagicMock()
    payload = {
        "song_url": "https://youtube.com/watch?v=dQw4w9WgXcQ",
        "song_added_by": "Singer",
        "song_title": "Never Gonna Give You Up",
        "queue": True,
    }
    resp = client.post("/api/downloads", json=payload)
    assert resp.status_code == 200
    assert resp.get_json() == {"status": "ok"}
    fake_karaoke.download_manager.queue_download.assert_called_once_with(
        "https://youtube.com/watch?v=dQw4w9WgXcQ",
        True,
        "Singer",
        "Never Gonna Give You Up",
    )


def test_get_downloads_passthrough(client, fake_karaoke):
    fake_karaoke.download_manager = MagicMock()
    mock_status = {
        "active": [{"id": "1", "title": "Active Song"}],
        "pending": [],
        "errors": [{"id": "err1", "title": "Failed Song", "error": "Some error"}],
    }
    fake_karaoke.download_manager.get_downloads_status.return_value = mock_status

    resp = client.get("/api/downloads")
    assert resp.status_code == 200
    assert resp.get_json() == mock_status
    fake_karaoke.download_manager.get_downloads_status.assert_called_once()


def test_delete_error(client, fake_karaoke):
    fake_karaoke.download_manager = MagicMock()
    fake_karaoke.download_manager.remove_error.return_value = True

    resp = client.delete("/api/downloads/errors/err1")
    assert resp.status_code == 200
    assert resp.get_json() == {"success": True}
    fake_karaoke.download_manager.remove_error.assert_called_once_with("err1")
