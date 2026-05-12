import requests


class ModelService:
    BASE_URL = "http://unified_api:5003/predict"  # Docker service name, not localhost

    def call_unified_api(self, payload: dict) -> dict:
        try:
            res = requests.post(self.BASE_URL, json=payload, timeout=15)
            return res.json()
        except Exception as e:
            return {"error": str(e)}

    def get_vehicle_health(self, trip_data: dict) -> dict:
        """
        بياخد الـ raw trip document من MongoDB ويحوله للـ payload
        اللي الـ unified API بيقبله، وبيرجع vehicle_health فقط.
        """
        if not trip_data:
            return {}

        # استخرج الـ nested fields من document الـ MongoDB
        trip_summary  = trip_data.get("trip_summary", {})
        behavior      = trip_data.get("driving_behavior", {})
        vehicle_info  = trip_data.get("vehicle_info", {})
        sensor_data   = trip_data.get("sensor_data", {})

        payload = {
            # Trip
            "avg_speed":          trip_summary.get("avg_speed", 0),
            "max_speed":          trip_summary.get("max_speed", 0),
            "overspeed_ratio":    trip_summary.get("overspeed_ratio", 0),
            "speed_variance":     trip_summary.get("speed_variance", 0),
            "trip_duration_min":  trip_summary.get("duration_min", 0),
            "distance_km":        trip_summary.get("distance_km", 0),

            # Behavior
            "harsh_brake_count":  behavior.get("harsh_brake_count", 0),
            "harsh_accel_count":  behavior.get("harsh_accel_count", 0),

            # Sensor
            "accelerometer_data": sensor_data.get("accelerometer_data", []),
            "gyroscope_data":     sensor_data.get("gyroscope_data", []),

            # Vehicle
            "engine_cc":              vehicle_info.get("engine_cc", 0),
            "engine_power_hp":        vehicle_info.get("engine_power_hp", 0),
            "weight_kg":              vehicle_info.get("weight_kg", 0),
            "fuel_combined_l_100km":  vehicle_info.get("fuel_combined_l_100km", 0),
            "year":                   vehicle_info.get("year", 2020),
        }

        result = self.call_unified_api(payload)

        if "error" in result:
            return {}

        # رجّع vehicle_health فقط من الـ response
        return result.get("vehicle_health", {})
