"""Tests for /api/search."""

from unittest.mock import patch


def test_api_search_requires_q(client):
    resp = client.get("/api/search")
    assert resp.status_code == 422  # Validation error (missing q)


@patch("pikaraoke.routes.api.search.get_search_results")
def test_api_search_returns_mapped_results(mock_get_results, client):
    # Mock return list of [title, url, id]
    mock_get_results.return_value = [
        ["Bohemian Rhapsody", "https://youtube.com/watch?v=fJ9rUzIMcZQ", "fJ9rUzIMcZQ"],
        ["Don't Stop Me Now", "https://youtube.com/watch?v=HgzGwKwLmgM", "HgzGwKwLmgM"],
    ]

    resp = client.get("/api/search?q=queen")
    assert resp.status_code == 200

    # Ensure query was appended with ' karaoke'
    mock_get_results.assert_called_once_with("queen karaoke")

    # Check payload is mapped correctly
    data = resp.get_json()
    assert len(data) == 2
    assert data[0] == {
        "title": "Bohemian Rhapsody",
        "url": "https://youtube.com/watch?v=fJ9rUzIMcZQ",
        "id": "fJ9rUzIMcZQ",
    }
    assert data[1] == {
        "title": "Don't Stop Me Now",
        "url": "https://youtube.com/watch?v=HgzGwKwLmgM",
        "id": "HgzGwKwLmgM",
    }


@patch("pikaraoke.routes.api.search.get_search_results")
def test_api_search_non_karaoke(mock_get_results, client):
    mock_get_results.return_value = []
    resp = client.get("/api/search?q=queen&non_karaoke=true")
    assert resp.status_code == 200
    mock_get_results.assert_called_once_with("queen")
