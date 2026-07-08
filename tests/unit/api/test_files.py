"""Tests for /api/files."""

from unittest.mock import MagicMock, patch


def test_browse_lists_files(client, fake_karaoke):
    fake_karaoke.song_manager = MagicMock()
    fake_karaoke.song_manager.songs = ["/songs/Song A.mp4", "/songs/Song B.mp4"]
    fake_karaoke.song_manager.display_name_from_path.side_effect = lambda x: x.split("/")[-1]
    fake_karaoke.browse_results_per_page = 10

    resp = client.get("/api/files/browse")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["total"] == 2
    assert data["page"] == 1
    assert data["perPage"] == 10
    assert len(data["files"]) == 2
    assert data["files"][0]["path"] == "/songs/Song A.mp4"
    assert data["files"][0]["displayName"] == "Song A.mp4"


def test_browse_filters_by_query(client, fake_karaoke):
    fake_karaoke.song_manager = MagicMock()
    fake_karaoke.song_manager.songs = [
        "/songs/Queen - Bohemian.mp4",
        "/songs/Beatles - Yesterday.mp4",
    ]
    fake_karaoke.song_manager.display_name_from_path.side_effect = lambda x: x.split("/")[-1]
    fake_karaoke.browse_results_per_page = 10

    resp = client.get("/api/files/browse?q=queen")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["total"] == 1
    assert len(data["files"]) == 1
    assert data["files"][0]["displayName"] == "Queen - Bohemian.mp4"


def test_delete_requires_admin(client):
    resp = client.delete("/api/files?song=test.mp4")
    assert resp.status_code == 403


def test_delete_refuses_queued_song(admin_client, fake_karaoke):
    fake_karaoke.queue_manager.is_song_in_queue.return_value = True
    resp = admin_client.delete("/api/files?song=test.mp4")
    assert resp.status_code == 409
    assert resp.get_json() == {"error": "Song is in the current queue"}


@patch("pikaraoke.routes.api.files.os.path.isfile")
def test_delete_removes_song(mock_isfile, admin_client, fake_karaoke):
    mock_isfile.return_value = True
    fake_karaoke.song_manager = MagicMock()
    fake_karaoke.queue_manager.is_song_in_queue.return_value = False

    resp = admin_client.delete("/api/files?song=test.mp4")
    assert resp.status_code == 200
    assert resp.get_json() == {"success": True, "message": "Song deleted"}
    fake_karaoke.song_manager.delete.assert_called_once_with("test.mp4")


@patch("pikaraoke.routes.api.files.os.path.isfile")
def test_delete_non_existent_file(mock_isfile, admin_client, fake_karaoke):
    mock_isfile.return_value = False
    fake_karaoke.queue_manager.is_song_in_queue.return_value = False

    resp = admin_client.delete("/api/files?song=missing.mp4")
    assert resp.status_code == 404
    assert resp.get_json() == {"error": "Song file not found"}


def test_rename_requires_admin(client):
    resp = client.patch("/api/files", json={"old_file_name": "a", "new_file_name": "b"})
    assert resp.status_code == 403


@patch("pikaraoke.routes.api.files.os.path.isfile")
@patch("pikaraoke.routes.api.files.youtube_id_suffix")
def test_rename_delegates(mock_youtube_id_suffix, mock_isfile, admin_client, fake_karaoke):
    fake_karaoke.song_manager = MagicMock()
    fake_karaoke.song_manager.download_path = "/fake/path"
    fake_karaoke.queue_manager.is_song_in_queue.return_value = False
    mock_youtube_id_suffix.return_value = " [abc12345678]"

    # First isfile check for source, second for target
    mock_isfile.side_effect = lambda path: path == "Old Song [abc12345678].mp4"

    resp = admin_client.patch(
        "/api/files",
        json={"old_file_name": "Old Song [abc12345678].mp4", "new_file_name": "New Song"},
    )
    assert resp.status_code == 200
    assert resp.get_json() == {"success": True, "message": "Song renamed"}

    # Check that youtube_id_suffix was called with the old name
    mock_youtube_id_suffix.assert_called_once_with("Old Song [abc12345678].mp4")
    # song_manager.rename should be called with old_name and new_name_full
    fake_karaoke.song_manager.rename.assert_called_once_with(
        "Old Song [abc12345678].mp4", "New Song [abc12345678]"
    )


@patch("pikaraoke.routes.api.files.os.path.isfile")
def test_rename_non_existent_source(mock_isfile, admin_client, fake_karaoke):
    fake_karaoke.queue_manager.is_song_in_queue.return_value = False
    mock_isfile.return_value = False  # Source doesn't exist

    resp = admin_client.patch(
        "/api/files",
        json={"old_file_name": "missing.mp4", "new_file_name": "New Name"},
    )
    assert resp.status_code == 404
    assert resp.get_json() == {"error": "Source song file not found"}


@patch("pikaraoke.routes.api.files.os.path.isfile")
@patch("pikaraoke.routes.api.files.youtube_id_suffix")
def test_rename_target_collision(mock_youtube_id_suffix, mock_isfile, admin_client, fake_karaoke):
    fake_karaoke.song_manager = MagicMock()
    fake_karaoke.song_manager.download_path = "/fake/path"
    fake_karaoke.queue_manager.is_song_in_queue.return_value = False
    mock_youtube_id_suffix.return_value = " [abc12345678]"

    # Source exists, target also exists
    mock_isfile.return_value = True

    resp = admin_client.patch(
        "/api/files",
        json={"old_file_name": "Old Song [abc12345678].mp4", "new_file_name": "New Song"},
    )
    assert resp.status_code == 409
    assert resp.get_json() == {"error": "Filename already exists"}


@patch("pikaraoke.routes.api.files.os.path.isfile")
@patch("pikaraoke.routes.api.files.youtube_id_suffix")
def test_rename_noop_casing(mock_youtube_id_suffix, mock_isfile, admin_client, fake_karaoke):
    fake_karaoke.song_manager = MagicMock()
    fake_karaoke.song_manager.download_path = "/fake/path"
    fake_karaoke.queue_manager.is_song_in_queue.return_value = False
    mock_youtube_id_suffix.return_value = " [abc12345678]"

    # Source exists
    mock_isfile.return_value = True

    # Call with same name (no-op)
    resp = admin_client.patch(
        "/api/files",
        json={"old_file_name": "/fake/path/Song [abc12345678].mp4", "new_file_name": "Song"},
    )
    assert resp.status_code == 200
    assert resp.get_json() == {"success": True, "message": "Song renamed"}
    # No rename should be performed if path is completely identical
    fake_karaoke.song_manager.rename.assert_not_called()
