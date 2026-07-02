"""Tests for /api/player."""


def test_post_player_action_requires_admin(client):
    assert client.post("/api/player/action", json={"action": "stop"}).status_code == 403


def test_post_player_action_play(admin_client, fake_karaoke):
    fake_karaoke.playback_controller.is_paused = True
    fake_karaoke.playback_controller.pause.return_value = True
    resp = admin_client.post("/api/player/action", json={"action": "play"})
    assert resp.status_code == 200
    fake_karaoke.playback_controller.pause.assert_called_once()


def test_post_player_action_play_idempotent(admin_client, fake_karaoke):
    fake_karaoke.playback_controller.is_paused = False
    resp = admin_client.post("/api/player/action", json={"action": "play"})
    assert resp.status_code == 200
    fake_karaoke.playback_controller.pause.assert_not_called()


def test_post_player_action_pause(admin_client, fake_karaoke):
    fake_karaoke.playback_controller.is_paused = False
    fake_karaoke.playback_controller.pause.return_value = True
    resp = admin_client.post("/api/player/action", json={"action": "pause"})
    assert resp.status_code == 200
    fake_karaoke.playback_controller.pause.assert_called_once()


def test_post_player_action_pause_idempotent(admin_client, fake_karaoke):
    fake_karaoke.playback_controller.is_paused = True
    resp = admin_client.post("/api/player/action", json={"action": "pause"})
    assert resp.status_code == 200
    fake_karaoke.playback_controller.pause.assert_not_called()


def test_post_player_action_stop(admin_client, fake_karaoke):
    resp = admin_client.post("/api/player/action", json={"action": "stop"})
    assert resp.status_code == 200
    fake_karaoke.playback_controller.end_song.assert_called_once()


def test_post_player_action_skip(admin_client, fake_karaoke):
    fake_karaoke.playback_controller.skip.return_value = True
    resp = admin_client.post("/api/player/action", json={"action": "skip"})
    assert resp.status_code == 200
    fake_karaoke.playback_controller.skip.assert_called_once()


def test_post_player_action_restart(admin_client, fake_karaoke):
    fake_karaoke.restart.return_value = True
    resp = admin_client.post("/api/player/action", json={"action": "restart"})
    assert resp.status_code == 200
    fake_karaoke.restart.assert_called_once()


def test_post_player_action_handles_failure(admin_client, fake_karaoke):
    fake_karaoke.playback_controller.skip.return_value = False
    resp = admin_client.post("/api/player/action", json={"action": "skip"})
    assert resp.status_code == 409
    assert resp.json["success"] is False


def test_post_player_action_invalid_action(admin_client):
    resp = admin_client.post("/api/player/action", json={"action": "dance"})
    assert resp.status_code == 422


def test_get_player_volume(admin_client, fake_karaoke):
    resp = admin_client.get("/api/player/volume")
    assert resp.status_code == 200
    assert resp.json["volume"] == 0.85


def test_post_player_volume(admin_client, fake_karaoke):
    fake_karaoke.volume_change.return_value = True
    resp = admin_client.post("/api/player/volume", json={"level": 0.5})
    assert resp.status_code == 200
    fake_karaoke.volume_change.assert_called_once_with(0.5)


def test_post_player_volume_failure(admin_client, fake_karaoke):
    fake_karaoke.volume_change.return_value = False
    resp = admin_client.post("/api/player/volume", json={"level": 0.5})
    assert resp.status_code == 409
    assert resp.json["success"] is False


def test_get_player_pitch(admin_client, fake_karaoke):
    resp = admin_client.get("/api/player/pitch")
    assert resp.status_code == 200
    assert resp.json["pitch"] == 0


def test_post_player_pitch(admin_client, fake_karaoke):
    resp = admin_client.post("/api/player/pitch", json={"level": -2})
    assert resp.status_code == 200
    fake_karaoke.transpose_current.assert_called_once_with(-2)
