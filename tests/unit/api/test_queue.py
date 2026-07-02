"""Tests for /api/queue."""

def test_get_queue(client, fake_karaoke):
    fake_karaoke.queue_manager.queue = [{"file": "1", "song": "Test"}]
    resp = client.get("/api/queue")
    assert resp.status_code == 200
    assert resp.get_json() == [{"file": "1", "song": "Test"}]


def test_post_queue(client, fake_karaoke):
    fake_karaoke.queue_manager.enqueue.return_value = [True, "Added"]
    resp = client.post("/api/queue", json={"song_id": "dQw4w9WgXcQ", "user": "Singer"})
    assert resp.status_code == 200
    assert resp.get_json() == {"success": True}
    fake_karaoke.queue_manager.enqueue.assert_called_once_with("dQw4w9WgXcQ", "Singer")


def test_post_queue_error(client, fake_karaoke):
    fake_karaoke.queue_manager.enqueue.return_value = [False, "Limit reached"]
    resp = client.post("/api/queue", json={"song_id": "dQw4w9WgXcQ", "user": "Singer"})
    assert resp.status_code == 400
    assert resp.get_json() == {"error": "Limit reached"}
    fake_karaoke.queue_manager.enqueue.assert_called_once_with("dQw4w9WgXcQ", "Singer")


def test_put_queue_item_requires_admin(client):
    assert client.put("/api/queue/1", json={"user": "New"}).status_code == 403


def test_put_queue_item_admin(admin_client, fake_karaoke):
    fake_karaoke.queue_manager._find_song_index.return_value = 0
    fake_karaoke.queue_manager.queue = [{"file": "1", "user": "Old"}]
    resp = admin_client.put("/api/queue/1", json={"user": "New"})
    assert resp.status_code == 200
    assert fake_karaoke.queue_manager.queue[0]["user"] == "New"
    fake_karaoke.queue_manager._events.emit.assert_called_with("queue_update")


def test_put_queue_item_not_found(admin_client, fake_karaoke):
    fake_karaoke.queue_manager._find_song_index.return_value = -1
    resp = admin_client.put("/api/queue/1", json={"user": "New"})
    assert resp.status_code == 404


def test_delete_queue_item_requires_admin(client):
    assert client.delete("/api/queue/1").status_code == 403


def test_delete_queue_item_admin(admin_client, fake_karaoke):
    fake_karaoke.queue_manager.queue_edit.return_value = True
    resp = admin_client.delete("/api/queue/1")
    assert resp.status_code == 200
    fake_karaoke.queue_manager.queue_edit.assert_called_once_with("1", "delete")


def test_delete_queue_item_not_found(admin_client, fake_karaoke):
    fake_karaoke.queue_manager.queue_edit.return_value = False
    resp = admin_client.delete("/api/queue/1")
    assert resp.status_code == 404


def test_delete_queue_all_requires_admin(client):
    assert client.delete("/api/queue").status_code == 403


def test_delete_queue_all_admin(admin_client, fake_karaoke):
    admin_client.delete("/api/queue")
    fake_karaoke.queue_manager.queue_clear.assert_called_once()
