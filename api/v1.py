from flask import Blueprint, Response, request
from lib.json_response import JSONResponse
from lib.mongo_helper import Database
from lib.smtp_helper import EmailServer
from pymongo import MongoClient
from lib.authenticated_decorator import authenticated
import bcrypt
from pymongo.synchronous.cursor import Cursor
from bson import ObjectId
import base64
import datetime
import os
from dotenv import load_dotenv
import json
from pathlib import Path
import secrets
import string


# Load Environment Variables - From Parent Directory
load_dotenv(
    Path(__file__).resolve().parent.parent / ".env"
)

BASE_URL: str = "http://localhost:80"  # TODO: Replace with production url
VERSION_NAME: str = "v1"
EMAIL_CONFIRMATION_CODE_LENGTH: int = 128
EMAIL_CONFIRMATION_MAX_TRIES: int = 7
LOGIN_ACCESS_TOKEN_LENGTH: int = 32
LOGIN_COOKIE_MAX_AGE: int = 7 * 24 * 60 * 60
MAX_LOGIN_SESSION_TOKENS: int = 10

VALID_ENTITY_TYPES: list[str] = ["individual"]

blueprint: Blueprint = Blueprint(VERSION_NAME, VERSION_NAME)

# Initialize Database
db: MongoClient = Database(
    uri=os.getenv("MONGO_CONNECTION_STRING")
).client

# Initialze Email Server
email_server: EmailServer = EmailServer(
    username=os.getenv("SMTP_USERNAME"),
    password=os.getenv("SMTP_PASSWORD"),
    sender_name=os.getenv("SMTP_SENDER_NAME")
)


@blueprint.post("/signup/")
def signup() -> Response:
    """
    Endpoint for user signup.
    """

    # Couldn't Parse JSON Body
    try: request.json
    except: return JSONResponse({"success": False, "error": "Invalid credentials"}, 400)

    # Gather Data
    display_name: str = request.json.get("display_name")
    email: str = request.json.get("email")
    password: str = request.json.get("password")

    # Validate Data
    if None in (display_name, email, password):
        return JSONResponse({"success": False, "error": "Invalid credentials"}, 400)
    
    # Fetch Account - Might Already Exist
    account = db["costix"]["registered_accounts"].find_one({"email": email})

    # Account Already Exists
    if account is not None:
        return JSONResponse({"success": False, "error": "Account already exists."}, 409)  # Conflict

    # Generate New Confirmation Code
    confirmation_code: str = "".join(secrets.choice(
        string.ascii_letters + string.digits
    ) for _ in range(EMAIL_CONFIRMATION_CODE_LENGTH))

    # Attempt Generating Confirmation Code
    confirmation_code_attempt: int = 0

    while True:
        # Max Tries Reached?
        if confirmation_code_attempt > EMAIL_CONFIRMATION_MAX_TRIES:
            return JSONResponse({
                "success": False,
                "error": "Couldn't generate confirmation code on the server side."
            }, 500)

        # Generate New Confirmation Code
        confirmation_code: str = "".join(secrets.choice(
            string.ascii_letters + string.digits
        ) for _ in range(EMAIL_CONFIRMATION_CODE_LENGTH))

        # Fetch Conflicting Account
        conflicting_account = db["costix"]["pending_signups"].find_one({
            "confirmation_code": confirmation_code
        })

        # Confirmation Code Already Exists
        if conflicting_account is None:
            break
        
        confirmation_code_attempt += 1
    
    # Hash Password
    password_hash: str = bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt()
    ).decode("utf-8")

    # Add Pending Signup to Database
    try:
        db["costix"]["pending_signups"].update_one(
            {"email": email},
            {"$set": {
                "confirmation_code": confirmation_code,
                "display_name": display_name,
                "password_hash": password_hash
            }},
            upsert=True
        )
    
    # Insertion Failed
    except: return JSONResponse({"success": False, "error": "Something went wrong!"}, 500)

    # Send Confirmation Email
    email_sent = email_server.send_email(
        recipient_email=email,
        subject="Signup Confirmation - Costix",
        text=f"Welcome abroad!\n\nPlease click on this link to confirm your account creation:\n\n{BASE_URL}/api/{VERSION_NAME}/confirm-signup?code={confirmation_code}\n\nIf this wasn't you, please ignore this email.\n\n- Team Costix"
    )
    
    # 200 OK
    if email_sent: return JSONResponse({"success": True}, 200)

    # Email Not Sent
    return JSONResponse({"success": False, "error": "We couldn't send confirmation email."}, 500)


@blueprint.post("/login/")
def login() -> Response:
    """
    Endpoint for user login.
    """

    # Couldn't Parse JSON Body
    try: request.json
    except: return JSONResponse({"success": False, "error": "Missing credentials!"}, 400)

    # Gather Data
    email: str = request.json.get("email")
    password: str = request.json.get("password")

    # Validate Data
    if None in (email, password):
        return JSONResponse({"success": False, "error": "Missing credentials!"}, 400)
    
    # Fetch Account Details
    account = db["costix"]["registered_accounts"].find_one({"email": email})

    # Account Doesn't Exist
    if account is None:
        return JSONResponse({"success": False, "error": "Account doesn't exist."}, 404)

    # Incorrect Password!
    if not bcrypt.checkpw(
        password.encode("utf-8"),
        account.get("password_hash", "").encode("utf-8")
    ):
        return JSONResponse({"success": False, "error": "Incorrect password!"}, 401)

    # Generate Session Token
    session_token: str = secrets.token_hex(LOGIN_ACCESS_TOKEN_LENGTH)

    # Add Session Token to Database
    try:
        session_tokens: list[str] = db["costix"]["registered_accounts"].find_one({
            "_id": account["_id"],
        }, {"session_tokens": 1}).get("session_tokens", [])

        # Ensure session_tokens are limited
        if len(session_tokens) >= MAX_LOGIN_SESSION_TOKENS:
            session_tokens = session_tokens[:MAX_LOGIN_SESSION_TOKENS]
            session_tokens.pop(0)

        # Add New Session Token
        session_tokens.append(session_token)

        # Update New Session Tokens Array in Cloud DB
        db["costix"]["registered_accounts"].update_one(
            {"_id": account["_id"]},
            {"$set": {
                "session_tokens": session_tokens
            }},
            upsert=False
        )
    
    # Updation Failed
    except: return JSONResponse({"success": False, "error": "Something went wrong!"}, 500)

    # Prepare API Response
    response: Response = Response(
        response=json.dumps({
            "success": True,
            "uid": str(account["_id"]),
            "session_token": session_token
        }),
        status=200,
        content_type="application/json"
    )

    # Compute Bearer Token
    encoded_bearer_token: str = base64.b64encode(json.dumps({
        "uid": str(account["_id"]),
        "session_token": session_token
    }).encode("utf-8")).decode("utf-8")

    # Add Auth Cookie
    response.set_cookie(
        "session_token",
        encoded_bearer_token,
        httponly=True,
        secure=False,
        samesite="Strict",
        max_age=LOGIN_COOKIE_MAX_AGE
    )

    return response


@blueprint.get("/confirm-signup/")
def confirm_signup() -> Response:
    """
    Endpoint to confirm user account creation through confirmation link.
    """

    # Gather Data
    confirmation_code: str = request.args.get("code", "").strip()

    # Validate Data
    if confirmation_code == "":
        return Response("Confirmation link invalid or expired.", 401)

    # Fetch Pending Account
    pending_account = db["costix"]["pending_signups"].find_one({
        "confirmation_code": confirmation_code
    })

    # Invalid Confirmation Code
    if pending_account is None:
        return Response("Confirmation link invalid or expired.", 401)

    # Get Pending Account Data
    pending_email: str = pending_account.get("email", "")
    pending_display_name: str = pending_account.get("display_name", "")
    pending_password_hash: str = pending_account.get("password_hash", "")

    # Validate Pending Account Data
    if pending_email == "" or pending_display_name == "":
        return Response("Something went wrong. Please try signing up once again.", 500)

    # Email Already Registered?
    conflicting_account = db["costix"]["registered_accounts"].find_one({
        "email": pending_email
    })

    # Conflict - Email Already Registered!
    if conflicting_account is not None:
        return Response("An account with this email is already registered.", 409)

    # Add Registered Account to Database
    try:
        db["costix"]["registered_accounts"].insert_one({
            "email": pending_email,
            "display_name": pending_display_name,
            "password_hash": pending_password_hash,
            "creation_time": str(datetime.datetime.now())
        })
    
    # Insertion Failed
    except Exception: return Response("Something went wrong. Please try signing up once again.", 500)

    # Invalidate Confirmation Code
    db["costix"]["pending_signups"].delete_many({
        "confirmation_code": confirmation_code
    })
    
    # Notify "Account Created Successfully"
    return Response("Your account is successfully created! Please go back and login with your credentials.", 200)


@blueprint.get("/entities/")
@authenticated
def fetch_entities(uid: str = None) -> Response:
    """
    Endpoint to fetch users' entities.
    """

    result: list[dict] = []

    # Fetch User Entities
    entities: Cursor = db["costix"]["user_entities"].find({"uid": uid})

    # Stringify _id's
    for entity in entities:
        last_updated_date: datetime.datetime = entity["last_updated"]

        result.append({
            "entity_id": str(entity["_id"]),
            "type": entity["type"],
            "name": entity["name"],
            "amount": entity["amount"],
            "last_updated": last_updated_date.isoformat()
        })

    # Return Entities
    return JSONResponse(result, 200)


@blueprint.post("/create-entity/")
@authenticated
def create_entity(uid: str = None) -> Response:
    """
    Endpoint to create a new entity.
    """

    # Couldn't Parse JSON Body
    try: request.json
    except: return JSONResponse({"success": False, "error": "Please give details."}, 400)

    # Gather Data
    entity_type: str = request.json.get("type").strip()
    entity_name: str = request.json.get("name").strip()

    # Validate Entity Type
    if entity_type not in VALID_ENTITY_TYPES:
        return JSONResponse({"success": False, "error": "Invalid entity type."}, 400)
    
    # Validate Entity Name
    if entity_name == "":
        return JSONResponse({"success": False, "error": "Invalid name"}, 400)

    # Insert Entity in Database
    entity = db["costix"]["user_entities"].insert_one({
        "uid": uid,
        "type": entity_type,
        "name": entity_name,
        "amount": 0,
        "last_updated": datetime.datetime.now(datetime.timezone.utc)
    })

    # 200 OK
    return JSONResponse({
        "success": True,
        "entity_id": str(entity.inserted_id)
    }, 200)


@blueprint.delete("/delete-entity/<entity_id>/")
@authenticated
def delete_entity(entity_id: str, uid: str = None) -> Response:
    """
    Endpoint to delete an entity.
    """

    # Parse Data
    entity_id: str = entity_id.strip()

    # Validate Entity ID
    if entity_id == "":
        return JSONResponse({"success": False, "error": "Invalid entity ID."}, 400)

    try:
        # Remove Entity from Database
        result = db["costix"]["user_entities"].delete_one({
            "_id": ObjectId(entity_id),
            "uid": uid
        })

        # Successfully Deleted?
        if result.deleted_count <= 0:
            return JSONResponse({"success": False, "error": "No such entity"}, 404)
    
    # Entity Not Found
    except:
        return JSONResponse({"success": False, "error": "Something went wrong."}, 404)
    
    # Remove Entity's Statements
    try:
        db["costix"]["statements"].delete_many({
            "entity_id": entity_id,
            "uid": uid
        })

    except: pass

    # 200 OK
    return JSONResponse({"success": True}, 200)


@blueprint.get("/entity/<entity_id>/")
@authenticated
def fetch_entity_details(entity_id: str, uid: str = None) -> Response:
    """
    Endpoint to fetch entity's details.
    """

    entity_id = entity_id.strip()  # Prepare Data

    # Validate Data
    if entity_id == "": return JSONResponse({"success": False, "error": "Invalid Entity ID."}, 400)

    # Fetch User Entities
    entity = db["costix"]["user_entities"].find_one({
        "_id": ObjectId(entity_id),
        "uid": uid
    })

    # No Entity Found?
    if entity is None:
        return JSONResponse({"success": False, "error": "This entity doesn't exist."}, 404)

    # Return Entity Details
    return JSONResponse({
        "success": True,
        "type": entity.get("type", ""),
        "name": entity.get("name", ""),
        "amount": entity.get("amount", 0)
    }, 200)


@blueprint.get("/total-owe/<mode>")
@authenticated
def fetch_total_owe(mode: str, uid: str = None) -> Response:
    """
    Endpoint to fetch logged in user's total owe amount.
    """

    account = None
    amount: int = 0

    # Fetch Account
    if mode == "extended":
        account = db["costix"]["registered_accounts"].find_one({
            "_id": ObjectId(uid)
        })

    # No Amount
    if db["costix"]["user_entities"].count_documents({"uid": uid}) <= 0:
        response_json: dict = {
            "success": True,
            "amount": 0
        }
    
    else:
        # Fetch All Entities
        entities: Cursor = db["costix"]["user_entities"].find({"uid": uid})

        # Calculate Amount
        for entity in entities:
            amount += entity.get("amount", 0)

        response_json: dict = {
            "success": True,
            "amount": amount
        }

    if mode == "extended":
        response_json["uid"] = uid
        response_json["display_name"] = account["display_name"]

    # Return Entity Details
    return JSONResponse(response_json, 200)


@blueprint.post("/statement/")
@authenticated
def add_statement(uid: str = None) -> Response:
    """
    Endpoint to add a new statement to specified user's entity.
    """

    # Couldn't Parse JSON Body
    try: request.json
    except: return JSONResponse({"success": False, "error": "Invalid statement details."}, 400)

    # Gather Data
    entity_id: int = request.json.get("entity_id")
    amount: int = request.json.get("amount")
    description: str = request.json.get("description", "").strip()

    # Validate Data
    if None in (entity_id, amount, description) or (description == ""):
        return JSONResponse({"success": False, "error": "Invalid statement details."}, 400)
    
    # Entity Exists?
    try:
        entity = db["costix"]["user_entities"].find_one({"_id": ObjectId(entity_id), "uid": uid})
    
    # Invalid ObjectId
    except:
        return JSONResponse({"success": False, "error": "This entity doesn't exist."}, 404)

    # Entity Doesn't Exist
    if entity is None:
        return JSONResponse({"success": False, "error": "This entity doesn't exist."}, 404)

    try:
        statement_date = datetime.datetime.now(datetime.timezone.utc)
        
        # Insert Statements in Database
        result = db["costix"]["statements"].insert_one({
            "type": "statement",
            "entity_id": entity_id,
            "uid": uid,
            "amount": amount,
            "description": description,
            "date": statement_date
        })

        # Update Entity Amount & Last Updated Date
        db["costix"]["user_entities"].update_one({
            "_id": ObjectId(entity_id),
            "uid": uid
        }, {
            "$inc": {"amount": amount},
            "$set": {"last_updated": statement_date}
        })

    # Insertion Error
    except:
        return JSONResponse({
            "success": False,
            "error": "Internal server error."
        }, 500)

    # Insertion Error
    if not result.inserted_id: return JSONResponse({
        "success": False,
        "error": "Internal server error."
    }, 500)

    # 200 OK
    return JSONResponse({
        "success": True,
        "statement_id": str(result.inserted_id),
        "date": statement_date.isoformat()
    }, 200)


@blueprint.get("/statements/<entity_id>/")
@authenticated
def fetch_statements(entity_id: str, uid: str = None) -> Response:
    """
    Endpoint to fetch statements of the specified entity.
    """

    entity_id = entity_id.strip()  # Prepare Data

    # Validate Data
    if entity_id == "": return JSONResponse({"success": False, "error": "Invalid Entity ID."}, 400)

    # Fetch User Entities
    entity = db["costix"]["user_entities"].find_one({
        "_id": ObjectId(entity_id),
        "uid": uid
    })

    # No Entity Found?
    if entity is None:
        return JSONResponse({"success": False, "error": "This entity doesn't exist."}, 404)
    
    # Fetch Statements
    statements: Cursor = db["costix"]["statements"].find({
        "entity_id": entity_id,
        "uid": uid
    })

    statements_array: list[dict] = []

    # Append Statements
    for statement in statements:
        statement_date: datetime.datetime = statement.get("date", "")

        try: statement_date_iso: str = statement_date.isoformat()
        except: statement_date_iso: str = ""

        statements_array.append({
            "id": str(statement.get("_id", "")),
            "type": statement.get("type", ""),
            "amount": statement.get("amount", 0),
            "description": statement.get("description", ""),
            "date": statement_date_iso
        })

    # Return Statements
    return JSONResponse({
        "success": True,
        "statements": statements_array
    }, 200)


@blueprint.post("/settle/")
@authenticated
def add_settlement(uid: str = None) -> Response:
    """
    Endpoint to add a settlement to specified user's entity.
    """

    # Couldn't Parse JSON Body
    try: request.json
    except: return JSONResponse({"success": False, "error": "Invalid settlement details."}, 400)

    # Gather Data
    entity_id: str = request.json.get("entity_id")
    amount: int = request.json.get("amount")

    # Validate Data
    if None in (entity_id, amount):
        return JSONResponse({"success": False, "error": "Invalid settlement details."}, 400)
    
    # Entity Exists?
    try:
        entity = db["costix"]["user_entities"].find_one({"_id": ObjectId(entity_id), "uid": uid})
    
    # Invalid ObjectId
    except:
        return JSONResponse({"success": False, "error": "This entity doesn't exist."}, 404)

    # Entity Doesn't Exist
    if entity is None:
        return JSONResponse({"success": False, "error": "This entity doesn't exist."}, 404)

    try:
        settlement_date = datetime.datetime.now(datetime.timezone.utc)
        
        # Insert Statements in Database
        result = db["costix"]["statements"].insert_one({
            "type": "settlement",
            "entity_id": entity_id,
            "uid": uid,
            "amount": amount,
            "date": settlement_date
        })

        # Update Entity Amount
        db["costix"]["user_entities"].update_one({
            "_id": ObjectId(entity_id),
            "uid": uid
        }, {
            "$inc": {"amount": amount},
            "$set": {"last_updated": settlement_date}
        })

    # Insertion Error
    except:
        return JSONResponse({
            "success": False,
            "error": "Internal server error."
        }, 500)

    # Insertion Error
    if not result.inserted_id: return JSONResponse({
        "success": False,
        "error": "Internal server error."
    }, 500)

    # 200 OK
    return JSONResponse({
        "success": True,
        "statement_id": str(result.inserted_id),
        "date": settlement_date.isoformat()
    }, 200)


@blueprint.post("/export-entity/<entity_id>")
@authenticated
def export_entity(entity_id: str, uid: str = None) -> Response:
    """
    Endpoint to export statements of the specified entity to a file.
    """

    entity_id = entity_id.strip()  # Prepare Data

    # Validate Data
    if entity_id == "": return JSONResponse({"success": False, "error": "Invalid Entity ID."}, 400)

    try:
        # Fetch User Entities
        entity = db["costix"]["user_entities"].find_one({
            "_id": ObjectId(entity_id),
            "uid": uid
        })

    # Invalid ObjectId
    except:
        return JSONResponse({"success": False, "error": "This entity doesn't exist."}, 404)

    # No Entity Found?
    if entity is None:
        return JSONResponse({"success": False, "error": "This entity doesn't exist."}, 404)
    
    # Fetch Statements
    statements: Cursor = db["costix"]["statements"].find({
        "entity_id": entity_id,
        "uid": uid
    })

    statements_array: list[dict] = []

    # Append Statements
    for statement in statements:
        statement_date: datetime.datetime = statement.get("date", "")

        try: statement_date_iso: str = statement_date.isoformat()
        except: statement_date_iso: str = ""

        statement_dict: dict = {
            "type": statement.get("type", ""),
            "date": statement_date_iso,
            "amount": f"₹{statement.get('amount', 0)}"
        }

        if statement.get("type", "") == "statement":
            statement_dict["description"] = statement.get("description", "")

        statements_array.append(statement_dict)

    # Return Statements
    return JSONResponse({
        "success": True,
        "entity": {
            "type": entity["type"],
            "name": entity["name"],
            "total_owe": entity["amount"],
            "statements": statements_array
        }
    }, 200)
