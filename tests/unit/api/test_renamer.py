"""Tests for /api/renamer."""

from unittest.mock import MagicMock, patch


def _setup_songs(fake_karaoke):
    fake_karaoke.song_manager = MagicMock()
    fake_karaoke.song_manager.songs = ["/x/Alpha.mp4", "/x/Beta.mp4"]
    fake_karaoke.song_manager.filename_from_path.side_effect = lambda p: p.rsplit("/", 1)[
        -1
    ].removesuffix(".mp4")


def test_songs_requires_admin(client):
    assert client.get("/api/renamer/songs").status_code == 403


@patch("pikaraoke.routes.api.renamer.get_song_correct_name")
def test_songs_lists_with_suggestions(mock_get_correct_name, admin_client, fake_karaoke):
    _setup_songs(fake_karaoke)
    # Alpha has mismatch, Beta matches perfectly
    mock_get_correct_name.side_effect = ["Alpha Suggested", "Beta"]

    resp = admin_client.get("/api/renamer/songs")
    assert resp.status_code == 200
    data = resp.get_json()

    assert data["total"] == 2
    assert data["page"] == 1
    assert len(data["songs"]) == 2
    assert data["songs"][0] == {
        "file": "/x/Alpha.mp4",
        "currentName": "Alpha",
        "suggestedName": "Alpha Suggested",
        "isEqual": False,
    }
    assert data["songs"][1] == {
        "file": "/x/Beta.mp4",
        "currentName": "Beta",
        "suggestedName": "Beta",
        "isEqual": True,
    }


@patch("pikaraoke.routes.api.renamer.get_song_correct_name")
def test_only_mismatched_filters(mock_get_correct_name, admin_client, fake_karaoke):
    _setup_songs(fake_karaoke)
    # Alpha has mismatch, Beta matches perfectly
    mock_get_correct_name.side_effect = ["Alpha Suggested", "Beta"]

    resp = admin_client.get("/api/renamer/songs?only_mismatched=true")
    assert resp.status_code == 200
    data = resp.get_json()

    assert data["total"] == 1
    assert len(data["songs"]) == 1
    assert data["songs"][0]["file"] == "/x/Alpha.mp4"
    assert data["songs"][0]["isEqual"] is False


def test_rename_requires_admin(client):
    assert (
        client.post(
            "/api/renamer/rename", json={"old_name": "/x/a.mp4", "new_name": "b"}
        ).status_code
        == 403
    )


def test_rename_refuses_queued_song(admin_client, fake_karaoke):
    fake_karaoke.queue_manager.is_song_in_queue.return_value = True
    resp = admin_client.post(
        "/api/renamer/rename", json={"old_name": "/x/Alpha.mp4", "new_name": "New Alpha"}
    )
    assert resp.status_code == 409
    assert resp.get_json() == {"error": "Song is in the current queue"}


@patch("pikaraoke.routes.api.renamer.os.path.isfile")
def test_rename_refuses_missing_file(mock_isfile, admin_client, fake_karaoke):
    mock_isfile.return_value = False
    fake_karaoke.queue_manager.is_song_in_queue.return_value = False
    resp = admin_client.post(
        "/api/renamer/rename", json={"old_name": "/x/Alpha.mp4", "new_name": "New Alpha"}
    )
    assert resp.status_code == 404
    assert resp.get_json() == {"error": "Source song file not found"}


@patch("pikaraoke.routes.api.renamer.os.path.isfile")
def test_rename_delegates(mock_isfile, admin_client, fake_karaoke):
    mock_isfile.return_value = True
    fake_karaoke.song_manager = MagicMock()
    fake_karaoke.queue_manager.is_song_in_queue.return_value = False

    resp = admin_client.post(
        "/api/renamer/rename", json={"old_name": "/x/Alpha.mp4", "new_name": "New Alpha"}
    )
    assert resp.status_code == 200
    assert resp.get_json() == {"success": True, "message": "Song renamed"}
    fake_karaoke.song_manager.rename.assert_called_once_with("/x/Alpha.mp4", "New Alpha")
