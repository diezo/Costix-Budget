from flask import request, Response
from lib.mongo_helper import Database
from pymongo import MongoClient
from bson import ObjectId
import os
import json
from dotenv import load_dotenv
from pathlib import Path
import base64
import functools


# Load Environment Variables - From Parent Directory
load_dotenv(
    Path(__file__).resolve().parent.parent / ".env"
)

# Initialize Database
db: MongoClient = Database(
    uri=os.getenv("MONGO_CONNECTION_STRING")
).client

def authenticated(func):
    """"
    Returns whether the request is authenticated or not.
    """

    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        """
        Fetches user's authentication state from Database.
        """
        
        if request.cookies.get("session_token", "") == "":
            return Response("", 401)

        # Decode Base64 Bearer Token
        try:
            bearer: str = base64.b64decode(
                request.cookies.get("session_token", "").strip().encode("utf-8")
            ).decode("utf-8")

        # Couldn't Parse Base64 Bearer Token
        except:
            return Response("", 401)
        
        # Parse Bearer JSON
        try:
            bearer_json: dict = json.loads(bearer)

            # Get Session Details
            uid: str = bearer_json.get("uid", "").strip()
            session_token: str = bearer_json.get("session_token", "").strip()

            # Invalid Format
            if uid == "" or session_token == "":
                return Response("", 401)
            
            # Get Account Details
            account = db["costix"]["registered_accounts"].find_one({"_id": ObjectId(uid)})

            # No Account Exists
            if account is None:
                return Response("", 401)
            
            # Incorrect Session Token
            if session_token not in account.get("session_tokens", []):
                return Response("", 401)
        
        # Couldn't Parse Bearer JSON
        except:
            return Response("", 401)
    
        # Authenticated!
        return func(*args, **kwargs, uid=uid)

    return wrapper


def authenticated_loose(func):
    """"
    Returns whether the request is authenticated or not.
    
    Loose means it doesn't automatically send '401 - Unauthenticated',
    and instead lets the parent function handle it.
    """

    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        """
        Fetches user's authentication state from Database.
        """
        
        if request.cookies.get("session_token", "") == "":
            return func(*args, **kwargs, uid=None)
        
        # Decode Base64 Bearer Token
        try:
            bearer: str = base64.b64decode(
                request.cookies.get("session_token", "").strip().encode("utf-8")
            ).decode("utf-8")

        # Couldn't Parse Base64 Bearer Token
        except:
            return func(*args, **kwargs, uid=None)
        
        # Parse Bearer JSON
        try:
            bearer_json: dict = json.loads(bearer)

            # Get Session Details
            uid: str = bearer_json.get("uid", "").strip()
            session_token: str = bearer_json.get("session_token", "").strip()

            # Invalid Format
            if uid == "" or session_token == "":
                return func(*args, **kwargs, uid=None)
            
            # Get Account Details
            account = db["costix"]["registered_accounts"].find_one({"_id": ObjectId(uid)})

            # No Account Exists
            if account is None:
                return func(*args, **kwargs, uid=None)
            
            # Incorrect Session Token
            if session_token not in account.get("session_tokens", []):
                return func(*args, **kwargs, uid=None)
        
        # Couldn't Parse Bearer JSON
        except:
            return func(*args, **kwargs, uid=None)
    
        # Authenticated!
        return func(*args, **kwargs, uid=uid)

    return wrapper
