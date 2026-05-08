from datetime import datetime, timedelta
from services.db import mongo


class ReportService:

    def get_weekly_report(self, user_id: str):
        if mongo.trips is None:
            return {}

        last_week = datetime.utcnow() - timedelta(days=7)

        pipeline = [
            {
                "$match": {
                    "user_id": user_id,
                    "start_time": {"$gte": last_week}
                }
            },
            {
                "$group": {
                    "_id": None,
                    "total_trips": {"$sum": 1},
                    "total_distance": {"$sum": "$trip_summary.distance_km"},
                    "avg_driver_score": {"$avg": "$driving_behavior.driver_score"},
                    "avg_fuel": {"$avg": "$fuel_efficiency.actual_fuel_l_100km"}
                }
            }
        ]

        result = list(mongo.trips.aggregate(pipeline))

        if not result:
            return {}

        report = result[0]
        report.pop("_id", None)
        return report