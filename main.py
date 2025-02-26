from dotenv import load_dotenv
from flask import Flask, render_template, redirect, Response
from lib.authenticated_decorator import authenticated_loose
from api import v1
from pymongo import MongoClient
from bson import ObjectId
from lib.mongo_helper import Database
import os


# Configurations
DEBUG: bool = False

load_dotenv()  # Load Environment Variables

# Initialize Server
server: Flask = Flask(__name__, template_folder="templates")

# Register API Blueprints
server.register_blueprint(v1.blueprint, url_prefix="/api/v1/")

# Initialize Database
db: MongoClient = Database(
    uri=os.getenv("MONGO_CONNECTION_STRING")
).client

# Page Endpoints
@server.get("/ping")
def ping():
    """
    Endpoint to ping the webservice.
    """

    return Response("", 200)


@server.get("/")
@authenticated_loose
def home(uid: str | None):
    """
    Renders home page or login page based on authentication state.
    """

    # Decide Template
    if uid is None:
        template_name: str = "login.html"
    else:
        template_name: str = "home.html"

    # Render Template
    return render_template(template_name)


@server.get("/details/<entity_id>")
@authenticated_loose
def details(entity_id: str, uid: str | None):
    """
    Renders details template.
    """

    # Unauthenticated?
    if uid is None: return redirect("/")

    try:
        # Get Entity Details
        entity_details = db["costix"]["user_entities"].find_one({
            "_id": ObjectId(entity_id)
        })
    
    # Invalid ObjectId?
    except: return Response("Sorry, this entity doesn't exist.", 404)

    # Entity Doesn't Exist?
    if entity_details is None: return Response("Sorry, this entity doesn't exist.", 404)

    # Render Template
    return render_template("details.html")

# Run Server
server.run(
    host="0.0.0.0",
    port=80,
    debug=DEBUG
)
