import json
from utils.helpers import serialize_mongo


class PromptBuilder:

    SYSTEM = """You are CarAI Assistant — a friendly, smart car advisor in a Smart Car app.

CRITICAL RULES:
- Detect the language of the user's message.
- If Arabic → respond ONLY in Egyptian Arabic.
- If English → respond ONLY in English.
- NEVER switch languages inside the same response.
- NEVER use formal Arabic (no "مرحباً", no "ما شاء الله").
- NEVER say system messages like "no data available" unless explicitly asked.

GREETING RULE:
- If the user is greeting (hi, hello, hey, عامل ايه, ازيك):
  → respond with a SHORT friendly greeting ONLY
  → DO NOT mention any data or system info

STYLE:
- Casual, human, smooth tone.
- Short replies unless user asks for details.
- Light emojis only (👋💡🔥).
- No robotic or generic responses.

BEHAVIOR:
- Only use trip/vehicle data when the user explicitly asks about car performance.
- If data is missing, still respond naturally WITHOUT mentioning missing data.

GOAL:
Sound like a real Egyptian smart assistant inside a car app — not an AI model.
"""

    TASK_MAP = {
        "greeting": "Respond with a short friendly greeting only.",
        "latest_trip": "Analyze the latest trip and give feedback on driving score, speed, and any harsh events.",
        "fuel_analysis": "Analyze fuel consumption. Is it normal? What's causing it? How to improve?",
        "vehicle_health": "Explain the vehicle health scores (engine, brakes, tires). What needs attention soon?",
        "driving_advice": "Give 3 practical tips to improve driving score and reduce wear on the vehicle.",
        "weekly_report": "Summarize weekly driving performance. Highlight improvements and areas to work on.",
        "general_question": "Answer the user's question based on available driving data.",
    }

    def is_greeting(self, msg: str) -> bool:
        msg = msg.lower().strip()
        return msg in [
            "hi", "hello", "hey",
            "عامل ايه", "عامل ايه؟",
            "ازيك", "إزيك", "ازيّك",
            "ايه الاخبار", "ايه اخبارك"
        ]

    def _extract_context(self, data: dict) -> str:
        if not data:
            return ""

        trip = data.get("trip_summary", {})
        behavior = data.get("driving_behavior", {})
        health = data.get("vehicle_health", {})
        fuel = data.get("fuel_efficiency", {})
        vehicle = data.get("vehicle_info", {})

        return f"""
Trip Summary:
- Distance: {trip.get("distance_km", "N/A")} km
- Duration: {trip.get("duration_min", "N/A")} min
- Avg Speed: {trip.get("avg_speed", "N/A")} km/h
- Max Speed: {trip.get("max_speed", "N/A")} km/h

Driving Behavior:
- Driver Score: {behavior.get("driver_score", "N/A")} / 100
- Driver Style: {behavior.get("driver_style", "N/A")}
- Harsh Brakes: {behavior.get("harsh_brake_count", "N/A")}
- Harsh Acceleration: {behavior.get("harsh_accel_count", "N/A")}

Vehicle Health:
- Overall Score: {health.get("vehicle_health_score", "N/A")} / 100
- Status: {health.get("health_status", "N/A")}
- Maintenance Risk: {health.get("maintenance_risk", "N/A")}
- Engine Health: {health.get("engine_health", "N/A")} / 100
- Brake Health: {health.get("brake_health", "N/A")} / 100
- Tire Health: {health.get("tire_health", "N/A")} / 100
- Alerts: {health.get("alerts", [])}

Fuel Efficiency:
- Actual Consumption: {fuel.get("actual_fuel_l_100km", "N/A")} L/100km
- Base: {fuel.get("base_fuel_l_100km", "N/A")} L/100km
- Efficiency Label: {fuel.get("efficiency_label", "N/A")}
- Trend: {fuel.get("trend", "N/A")}

Vehicle Info:
- Engine: {vehicle.get("engine_cc", "N/A")} cc / {vehicle.get("engine_power_hp", "N/A")} hp
- Weight: {vehicle.get("weight_kg", "N/A")} kg
- Year: {vehicle.get("year", "N/A")}
- Base Fuel: {vehicle.get("fuel_combined_l_100km", "N/A")} L/100km
"""

    def build(self, intent: str, user_message: str, data: dict) -> str:

        # 🔥 HARD OVERRIDE: greetings handled outside LLM logic
        if self.is_greeting(user_message):
            return "GREETING_MODE"

        task = self.TASK_MAP.get(intent, self.TASK_MAP["general_question"])
        context = self._extract_context(data)

        return f"""{self.SYSTEM}

User Question: {user_message}

Task: {task}

Data:
{context}

Answer:"""