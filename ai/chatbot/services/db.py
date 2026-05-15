from pymongo import MongoClient
from config.settings import settings

class MongoDB:
    def __init__(self):
        try:
            self.client = MongoClient(settings.MONGO_URI, serverSelectionTimeoutMS=3000)
            self.client.server_info()
            self.db = self.client["Smart-Car-Management-System"] 
            self.trips = self.db["trips"]
            print("MongoDB connected to: Smart-Car-Management-System")
        except Exception as e:
            print(f"MongoDB connection failed: {e}")
            self.trips = None

mongo = MongoDB()