"""Home page route."""

import flask_babel
from flask import Blueprint, render_template

_ = flask_babel.gettext


# ponytail: plain Flask Blueprint — flask_smorest.Blueprint drops route defaults,
# which breaks url_for("home.home"); smorest features unused by this HTML-only route.
home_bp = Blueprint("home", __name__)


@home_bp.route("/", defaults={"path": ""})
@home_bp.route("/<path:path>")
def home(path):
    """Fallback route for React SPA."""

    # Evitar conflitos com rotas de API e estáticos
    if path.startswith("api/") or path.startswith("static/"):
        from flask import abort

        abort(404)

    return render_template("index.html")
