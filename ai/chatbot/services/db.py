from pymongo import MongoClient
from config.settings import settings

class MongoDB:
    def __init__(self):
        try:
            self.client = MongoClient(settings.MONGO_URI, serverSelectionTimeoutMS=3000)
            self.client.server_info()
            self.db    = self.client[settings.DB_NAME]
            self.trips = self.db["trips"]
            print(f"MongoDB connected to: {settings.DB_NAME}", flush=True)
        except Exception as e:
            print(f"MongoDB connection failed: {e}", flush=True)
            self.db    = None
            self.trips = None


mongo = MongoDB()