"""Admin authentication endpoints for the /api mirror."""

import datetime

from flask import jsonify, make_response
from flask_smorest import Blueprint
from marshmallow import Schema, fields

from pikaraoke.lib.current_app import get_admin_password, is_admin

api_auth_bp = Blueprint("api_auth", __name__, url_prefix="/api")


class AuthBody(Schema):
    password = fields.String(required=True, metadata={"description": "Admin password"})


@api_auth_bp.route("/auth", methods=["GET"])
def auth_status():
    """Report whether the current request is authenticated as admin."""
    return jsonify({"isAdmin": is_admin()})


@api_auth_bp.route("/auth", methods=["POST"])
@api_auth_bp.arguments(AuthBody, location="json")
def auth_login(body):
    """Validate the admin password and set the legacy admin cookie."""
    admin_password = get_admin_password()
    if admin_password is not None and body["password"] != admin_password:
        return jsonify({"error": "Incorrect admin password"}), 403
    resp = make_response(jsonify({"isAdmin": True}))
    if admin_password is not None:
        expires = datetime.datetime.now() + datetime.timedelta(days=90)
        resp.set_cookie("admin", admin_password, expires=expires)
    return resp
