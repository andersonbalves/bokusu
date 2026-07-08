"""Tests for /api/search."""

from unittest.mock import patch


def test_api_search_requires_q(client):
    resp = client.get("/api/search")
    assert resp.status_code == 422  # Validation error (missing q)


@patch("pikaraoke.routes.api.search.get_search_results")
def test_search_appends_karaoke_by_default(mock_get_results, client):
    mock_get_results.return_value = [
        ["Bohemian Rhapsody", "https://youtube.com/watch?v=fJ9rUzIMcZQ", "fJ9rUzIMcZQ"]
    ]
    resp = client.get("/api/search?q=queen")
    assert resp.status_code == 200
    mock_get_results.assert_called_once_with("queen karaoke")
    data = resp.get_json()
    assert len(data) == 1
    assert data[0]["title"] == "Bohemian Rhapsody"


@patch("pikaraoke.routes.api.search.get_search_results")
def test_search_non_karaoke_skips_suffix(mock_get_results, client):
    mock_get_results.return_value = []
    resp = client.get("/api/search?q=queen&non_karaoke=true")
    assert resp.status_code == 200
    mock_get_results.assert_called_once_with("queen")


def test_autocomplete_matches_local_songs(client, fake_karaoke):
    from unittest.mock import MagicMock

    fake_karaoke.song_manager = MagicMock()
    fake_karaoke.song_manager.songs = [
        "/songs/Queen - Bohemian Rhapsody [fJ9rUzIMcZQ].mp4",
        "/songs/Beatles - Yesterday [abc12345678].mp4",
    ]
    fake_karaoke.song_manager.display_name_from_path.side_effect = lambda x: x.split("/")[-1]

    resp = client.get("/api/search/autocomplete?q=queen")
    assert resp.status_code == 200
    data = resp.get_json()
    assert len(data) == 1
    assert data[0]["path"] == "/songs/Queen - Bohemian Rhapsody [fJ9rUzIMcZQ].mp4"
    assert data[0]["fileName"] == "Queen - Bohemian Rhapsody [fJ9rUzIMcZQ].mp4"
    assert data[0]["type"] == "autocomplete"


@patch("pikaraoke.routes.api.search.get_stream_url")
def test_preview_returns_stream_url(mock_get_stream_url, client):
    mock_get_stream_url.return_value = "https://stream.youtube.com/abc"
    resp = client.get("/api/search/preview?url=https://youtube.com/watch?v=123")
    assert resp.status_code == 200
    assert resp.get_json() == {"stream_url": "https://stream.youtube.com/abc"}
    mock_get_stream_url.assert_called_once_with("https://youtube.com/watch?v=123")


@patch("pikaraoke.routes.api.search.get_stream_url")
def test_preview_500_when_unavailable(mock_get_stream_url, client):
    mock_get_stream_url.return_value = None
    resp = client.get("/api/search/preview?url=https://youtube.com/watch?v=123")
    assert resp.status_code == 500
    assert "error" in resp.get_json()
