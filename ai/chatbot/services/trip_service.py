import sys
from bson import ObjectId
from services.db import mongo


class TripService:

    def get_latest_trip(self, user_id: str):
        print(f">>> get_latest_trip called with user_id: {user_id}", flush=True)
        if mongo.trips is None:
            print("trips collection is None!", flush=True)
            return {}
        try:
            total = mongo.trips.count_documents({})
            print(f"Total trips in DB: {total}", flush=True)

            trip = mongo.trips.find_one(
                {"user": ObjectId(user_id)},
                sort=[("createdAt", -1)]
            )
            print(f"Trip found: {trip is not None}", flush=True)

            if not trip:
                return {}

            trip["_id"] = str(trip["_id"])
            trip["user"] = str(trip["user"])
            return trip

        except Exception as e:
            print(f"Error getting trip: {e}", flush=True)
            return {}

    def get_recent_trips(self, user_id: str, limit: int = 5):
        print(f">>> get_recent_trips called with user_id: {user_id}", flush=True)
        if mongo.trips is None:
            print("trips collection is None!", flush=True)
            return []
        try:
            total = mongo.trips.count_documents({})
            print(f"Total trips in DB: {total}", flush=True)

            trips = list(
                mongo.trips.find(
                    {"user": ObjectId(user_id)},
                    sort=[("createdAt", -1)],
                    limit=limit
                )
            )
            print(f"Trips found: {len(trips)}", flush=True)

            for t in trips:
                t["_id"] = str(t["_id"])
                t["user"] = str(t["user"])

            return trips

        except Exception as e:
            print(f"Error getting trips: {e}", flush=True)
            return []