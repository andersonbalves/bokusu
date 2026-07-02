"""Tests for /api/player."""


def test_post_player_action_requires_admin(client):
    assert client.post("/api/player/action", json={"action": "stop"}).status_code == 403


def test_post_player_action_executes_action(admin_client, fake_karaoke):
    resp = admin_client.post("/api/player/action", json={"action": "skip"})
    assert resp.status_code == 200
    fake_karaoke.playback_controller.skip.assert_called_once()


def test_post_player_action_invalid_action(admin_client):
    resp = admin_client.post("/api/player/action", json={"action": "dance"})
    assert resp.status_code == 422


def test_post_player_volume(admin_client, fake_karaoke):
    resp = admin_client.post("/api/player/volume", json={"level": 0.5})
    assert resp.status_code == 200
    fake_karaoke.set_volume.assert_called_once_with(0.5)


def test_post_player_pitch(admin_client, fake_karaoke):
    resp = admin_client.post("/api/player/pitch", json={"level": -2})
    assert resp.status_code == 200
    fake_karaoke.set_audio_pitch.assert_called_once_with(-2)
