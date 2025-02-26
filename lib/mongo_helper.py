from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi


class Database:
    """
    Manages all operations in MongoDB Atlas Database.
    """

    _instance = None
    _initialized = False

    client: MongoClient = None  # Database Instance


    def __new__(cls, *args, **kwargs):
        """
        Ensures the database class is Singleton, and shares single instance across every initialization.
        """

        if cls._instance is None: cls._instance = super().__new__(cls)
        return cls._instance


    def __init__(self, uri: str):
        """
        Connects with the cloud database.
        """

        if self._initialized: return  # Ensure Singleton Behaviour

        self.client = MongoClient(uri, server_api=ServerApi("1"))

        # Verify Database Connection - Ping It!
        try:
            self.client.admin.command("ping")
            print("Pinged MongoDB Database Server!")

        # Database Connection Failed
        except Exception as e: raise Exception(f"Couldn't connect to MongoDB Atlas Database! {e}")

        Database._initialized = True  # Ensure Singleton Behaviour
