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
    fake_karaoke.queue_manager.edit_user.return_value = True
    resp = admin_client.put("/api/queue/1", json={"user": "New"})
    assert resp.status_code == 200
    fake_karaoke.queue_manager.edit_user.assert_called_once_with("1", "New")


def test_put_queue_item_not_found(admin_client, fake_karaoke):
    fake_karaoke.queue_manager.edit_user.return_value = False
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


def test_reorder_queue_requires_admin(client):
    assert client.put("/api/queue/reorder", json={"old_index": 0, "new_index": 1}).status_code == 403


def test_reorder_queue_admin_success(admin_client, fake_karaoke):
    fake_karaoke.queue_manager.reorder.return_value = True
    resp = admin_client.put("/api/queue/reorder", json={"old_index": 0, "new_index": 1})
    assert resp.status_code == 200
    assert resp.get_json() == {"success": True}
    fake_karaoke.queue_manager.reorder.assert_called_once_with(0, 1)


def test_reorder_queue_admin_failure(admin_client, fake_karaoke):
    fake_karaoke.queue_manager.reorder.return_value = False
    resp = admin_client.put("/api/queue/reorder", json={"old_index": 0, "new_index": 1})
    assert resp.status_code == 400
    assert resp.get_json() == {"error": "Failed to reorder queue"}


def test_move_queue_item_requires_admin(client):
    assert client.patch("/api/queue/item", json={"song": "/x/a.mp4", "action": "top"}).status_code == 403


def test_move_queue_item_admin_success(admin_client, fake_karaoke):
    fake_karaoke.queue_manager.queue = [{"file": "/x/a.mp4", "title": "A"}]
    fake_karaoke.queue_manager.reorder.return_value = True
    resp = admin_client.patch("/api/queue/item", json={"song": "/x/a.mp4", "action": "top"})
    assert resp.status_code == 200
    assert resp.get_json() == {"success": True}
    fake_karaoke.queue_manager.reorder.assert_called_once_with(0, 0)


def test_move_queue_item_admin_not_found(admin_client, fake_karaoke):
    fake_karaoke.queue_manager.queue = []
    resp = admin_client.patch("/api/queue/item", json={"song": "/x/a.mp4", "action": "top"})
    assert resp.status_code == 404
    assert resp.get_json() == {"error": "Song not found in queue"}


def test_delete_queue_item_by_song_requires_admin(client):
    assert client.delete("/api/queue/item?song=/x/a.mp4").status_code == 403


def test_delete_queue_item_by_song_admin(admin_client, fake_karaoke):
    fake_karaoke.queue_manager.queue_edit.return_value = True
    resp = admin_client.delete("/api/queue/item?song=/x/a.mp4")
    assert resp.status_code == 200
    assert resp.get_json() == {"success": True}
    fake_karaoke.queue_manager.queue_edit.assert_called_once_with("/x/a.mp4", "delete")


def test_add_random_songs_requires_admin(client):
    assert client.post("/api/queue/random", json={"amount": 5}).status_code == 403


def test_add_random_songs_admin(admin_client, fake_karaoke):
    fake_karaoke.queue_manager.queue_add_random.return_value = True
    resp = admin_client.post("/api/queue/random", json={"amount": 5})
    assert resp.status_code == 200
    assert resp.get_json() == {"success": True}
    fake_karaoke.queue_manager.queue_add_random.assert_called_once_with(5)
