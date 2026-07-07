"""Splash screen master/slave election over Socket.IO."""

import pytest
from flask import Flask
from flask_socketio import SocketIO

from pikaraoke.routes import socket_events
from pikaraoke.routes.socket_events import setup_socket_events


def _reset_state():
    socket_events.splash_connections.clear()
    socket_events.master_splash_id = None


def _role_events(received: list) -> list[str]:
    return [e["args"][0] for e in received if e["name"] == "splash_role"]


@pytest.fixture(autouse=True)
def reset_splash_state():
    """Module-level globals persist across tests in the same process; reset every time."""
    _reset_state()
    yield
    _reset_state()


@pytest.fixture
def socketio_app():
    app = Flask(__name__)
    app.config["SECRET_KEY"] = "test"
    socketio = SocketIO(app, async_mode="threading")
    setup_socket_events(socketio)
    return app, socketio


@pytest.fixture
def socketio_client(socketio_app):
    app, socketio = socketio_app
    return socketio.test_client(app)


@pytest.fixture
def socketio_client_factory(socketio_app):
    app, socketio = socketio_app
    return lambda: socketio.test_client(app)


def test_first_splash_becomes_master(socketio_client):
    socketio_client.emit("register_splash")
    assert _role_events(socketio_client.get_received()) == ["master"]


def test_reregistering_master_stays_master(socketio_client):
    socketio_client.emit("register_splash")
    socketio_client.get_received()
    socketio_client.emit("register_splash")  # remount / StrictMode double effect
    assert _role_events(socketio_client.get_received()) == ["master"]


def test_second_splash_becomes_slave(socketio_client, socketio_client_factory):
    master = socketio_client
    slave = socketio_client_factory()
    master.emit("register_splash")
    slave.emit("register_splash")
    master.get_received()
    assert _role_events(slave.get_received()) == ["slave"]


def test_unregister_master_elects_remaining_slave(socketio_client, socketio_client_factory):
    master = socketio_client
    slave = socketio_client_factory()
    master.emit("register_splash")
    slave.emit("register_splash")
    master.get_received()
    assert _role_events(slave.get_received()) == ["slave"]

    master.emit("unregister_splash")
    assert _role_events(slave.get_received()) == ["master"]


def test_unregister_unknown_sid_is_a_noop(socketio_client):
    # Never registered; should not raise or affect global state.
    socketio_client.emit("unregister_splash")
    assert socket_events.master_splash_id is None


def test_disconnect_still_elects_remaining_slave(socketio_client, socketio_client_factory):
    master = socketio_client
    slave = socketio_client_factory()
    master.emit("register_splash")
    slave.emit("register_splash")
    master.get_received()
    slave.get_received()

    master.disconnect()
    assert _role_events(slave.get_received()) == ["master"]
