"""Home page route."""

import flask_babel
from flask import render_template
from flask_smorest import Blueprint

_ = flask_babel.gettext


home_bp = Blueprint("home", __name__)


@home_bp.route("/", defaults={"path": ""})
@home_bp.route("/<path:path>")
def catch_all(path):
    """Fallback route for React SPA."""

    # Evitar conflitos com rotas de API e estáticos
    if path.startswith("api/") or path.startswith("static/"):
        from flask import abort

        abort(404)

    return render_template("index.html")
