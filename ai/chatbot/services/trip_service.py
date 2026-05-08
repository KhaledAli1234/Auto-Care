from services.db import mongo


class TripService:

    def get_latest_trip(self, user_id: str):
        if mongo.trips is None:
            return {}

        trip = mongo.trips.find_one(
            {"user_id": user_id},
            sort=[("start_time", -1)]
        )

        if not trip:
            return {}

        trip["_id"] = str(trip["_id"])
        return trip

    def get_recent_trips(self, user_id: str, limit: int = 5):
        if mongo.trips is None:
            return []

        trips = list(
            mongo.trips.find(
                {"user_id": user_id},
                sort=[("start_time", -1)],
                limit=limit
            )
        )

        for t in trips:
            t["_id"] = str(t["_id"])

        return trips