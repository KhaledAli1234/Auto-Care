import re
from utils.helpers import serialize_mongo


class PromptBuilder:

    SYSTEM = """You are CarAI — a witty, warm car buddy living inside a Smart Driving app.
You talk to everyday drivers (young and old) who just want quick, honest feedback about their car and driving.

LANGUAGE RULES:
- Detect the language of the user's message automatically.
- If Arabic → reply ONLY in casual Egyptian Arabic (عامية مصرية).
- If English → reply ONLY in natural conversational English.
- NEVER mix languages in the same reply.
- NEVER use formal Arabic.
- NEVER use Franco/Arabizi like: Enta, ana, mashy, 3ayez, el, ya.
- If replying in Arabic, use Arabic letters only.

PERSONALITY:
- You're like that smart friend who knows cars — helpful, honest, occasionally funny.
- Warm and encouraging, never cold or robotic.
- Add a light joke or playful comment when it fits naturally — don't force it.
- Use emojis lightly to add energy, not to spam. Max 2 emojis.

STYLE RULES:
- Keep replies SHORT and clear unless the user asks for details.
- No long bullet walls.
- Celebrate good driving if score is high.
- If something needs attention, be honest but calm.
- Never say "based on the data" or "according to the system".
- If data is missing, say it naturally in the same language.

IMPORTANT SAFETY:
- Do not invent the user's name.
- Do not treat words like "اي", "إيه", "ايه", "what" as a name.
- If the user asks "انا اسمي ايه" and the name is not available, say you don't know their name yet.
- If the user asks about trips and total trips exists, answer with the number clearly.
- If the requested info is missing, say that naturally without making up numbers.
- NEVER invent driving scores, distances, or safety statistics if no real data is provided.
- If no trip data is available, say so directly. Do NOT make up encouraging stats.

GOAL:
Feel like texting a knowledgeable car-loving friend — not reading an AI report.
"""

    TASK_MAP = {
        "greeting":       "Respond with a short, warm, and slightly fun greeting. Keep it 1-2 lines max.",
        "latest_trip":    "Give a fun, honest recap of the latest trip. Highlight the driving score with energy. Mention speed or harsh events only if notable.",
        "fuel_analysis":  "Talk about fuel like a friend. Is it good or could be better? Give one simple tip to improve.",
        "vehicle_health": "Give a quick health check vibe. Mention what's good and what needs attention. Be reassuring unless urgent.",
        "driving_advice": "Give 2-3 practical tips that feel personal and actionable.",
        "safe_driving":   "Assess the user's driving safety honestly based ONLY on the data provided. If no data is available, say so clearly — do not invent scores.",
        "weekly_report":  "Summarize the week like a coach giving a pep talk. Mention total trips, distance, score, and fuel if available.",
        "general_question": "Answer naturally and helpfully based on the available data. Sound like a real person, not a manual.",
    }

    GREETING_TASK = {
        "arabic":  "رد بتحية قصيرة ودودة وخفيفة. جملة أو اتنين بالأكتر. بالعربي فقط.",
        "english": "Respond with a short, warm, and slightly fun greeting. Keep it 1-2 lines max. English only.",
    }

    def detect_language(self, msg: str) -> str:
        if not msg:
            return "english"
        arabic_chars = re.findall(r"[\u0600-\u06FF]", msg)
        if len(arabic_chars) > 0:
            return "arabic"
        return "english"

    def is_greeting(self, msg: str) -> bool:
        msg = msg.lower().strip()
        greetings = [
            "hi", "hello", "hey", "howdy", "sup",
            "what's up", "whats up",
            "good morning", "good evening", "good night",
            "عامل ايه", "عامل ايه؟", "عامل إيه",
            "ازيك", "إزيك", "ازيّك", "ازيك؟",
            "ايه الاخبار", "ايه اخبارك", "ايه الأخبار",
            "صباح الخير", "مساء الخير",
        ]
        return any(greeting in msg for greeting in greetings)

    def _extract_context(self, data: dict) -> str:
        if not data:
            return "NO_DATA"

        if "total_trips" in data:
            return f"""
Weekly Report:
- Total Trips:       {data.get("total_trips", "N/A")}
- Total Distance:    {round(data.get("total_distance", 0), 1)} km
- Avg Driver Score:  {round(data.get("avg_driver_score", 0), 1)} / 100
- Avg Fuel Usage:    {round(data.get("avg_fuel", 0), 2)} L/100km
"""

        data = serialize_mongo(data)

        trip     = data.get("trip_summary", {})
        behavior = data.get("driving_behavior", {})
        health   = data.get("vehicle_health", {})
        fuel     = data.get("fuel_efficiency", {})
        vehicle  = data.get("vehicle_info", {})
        user_raw = data.get("user", {}) or data.get("user_info", {}) or {}
        user     = user_raw if isinstance(user_raw, dict) else {}

        if not trip and not behavior and not health and not fuel:
            return "NO_DATA"

        return f"""
User Info:
- Name: {user.get("name", "N/A")}

Trip Summary:
- Distance:   {trip.get("distance_km", "N/A")} km
- Duration:   {trip.get("duration_min", "N/A")} min
- Avg Speed:  {trip.get("avg_speed", "N/A")} km/h
- Max Speed:  {trip.get("max_speed", "N/A")} km/h

Driving Behavior:
- Driver Score:        {behavior.get("driver_score", "N/A")} / 100
- Driver Style:        {behavior.get("driver_style", "N/A")}
- Harsh Brakes:        {behavior.get("harsh_brake_count", "N/A")}
- Harsh Acceleration:  {behavior.get("harsh_accel_count", "N/A")}

Vehicle Health:
- Overall Score:      {health.get("vehicle_health_score", "N/A")} / 100
- Status:             {health.get("health_status", "N/A")}
- Maintenance Risk:   {health.get("maintenance_risk", "N/A")}
- Engine Health:      {health.get("engine_health", "N/A")} / 100
- Brake Health:       {health.get("brake_health", "N/A")} / 100
- Tire Health:        {health.get("tire_health", "N/A")} / 100
- Alerts:             {health.get("alerts", [])}

Fuel Efficiency:
- Actual Consumption: {fuel.get("actual_fuel_l_100km", "N/A")} L/100km
- Base:               {fuel.get("base_fuel_l_100km", "N/A")} L/100km
- Efficiency Label:   {fuel.get("efficiency_label", "N/A")}
- Trend:              {fuel.get("trend", "N/A")}

Vehicle Info:
- Engine:    {vehicle.get("engine_cc", "N/A")} cc / {vehicle.get("engine_power_hp", "N/A")} hp
- Weight:    {vehicle.get("weight_kg", "N/A")} kg
- Year:      {vehicle.get("year", "N/A")}
- Base Fuel: {vehicle.get("fuel_combined_l_100km", "N/A")} L/100km
"""

    def _build_language_lock(self, detected_language: str) -> str:
        if detected_language == "arabic":
            return """
CRITICAL LANGUAGE LOCK:
- The user's current message is in Arabic.
- Reply ONLY in casual Egyptian Arabic (عامية مصرية).
- Use Arabic script (Arabic letters) only.
- Do NOT write in Franco-Arabic/Arabizi.
- Do NOT use formal Arabic (الفصحى). Speak like a close friend.
- Bad examples you must avoid: "Enta", "ana", "mashy", "3ayez", "el", "ya".
- Good style example: "أيوه يا صاحبي، أنت عملت 3 رحلات."
"""
        return """
CRITICAL LANGUAGE LOCK:
- The user's current message is in English.
- Reply ONLY in natural conversational English.
- Do NOT use Arabic words or Franco-Arabic.
"""

    def _sanitize_history(self, history: list) -> list:
        """بيتأكد إن الـ history فيها role و content بس ومش فيها حاجة غريبة"""
        sanitized = []
        for msg in history:
            role    = msg.get("role", "")
            content = msg.get("content", "")
            if role in ("user", "assistant") and content:
                sanitized.append({"role": role, "content": str(content)})
        return sanitized

    def build(self, intent: str, user_message: str, data: dict, history: list = []) -> list:
        detected_language = self.detect_language(user_message)
        language_lock     = self._build_language_lock(detected_language)
        system_prompt     = f"{self.SYSTEM}\n\n{language_lock}"

        # آخر 10 رسايل بس علشان ما نعداش الـ context window
        recent_history = self._sanitize_history(history[-10:])

        if self.is_greeting(user_message):
            task = self.GREETING_TASK[detected_language]
            return [
                {"role": "system",  "content": system_prompt},
                *recent_history,
                {"role": "user",    "content": f"User Question:\n{user_message}\n\nTask:\n{task}"}
            ]

        task    = self.TASK_MAP.get(intent, self.TASK_MAP["general_question"])
        context = self._extract_context(data)

        if context == "NO_DATA":
            data_section = """
Data:
No trip data is available for this user yet.

IMPORTANT: Since there is no real data, do NOT invent any numbers, scores, or driving stats.
Tell the user clearly (in the locked language) that you don't have their data yet."""
        else:
            data_section = f"""
Data:
{context}

Final Answer Rules:
- Answer in the locked language only.
- Keep it short and natural.
- Do not invent missing information.
- If the user asks for their name and it is N/A or missing, say you don't know it yet.
- If the user asks how many trips they made, use Total Trips if available.
- If Total Trips is not available, say you can't see the total trips right now.
- Do not repeat the user's question.
- Do not output explanations about language detection."""

        return [
            {"role": "system",  "content": system_prompt},
            *recent_history,
            {"role": "user",    "content": f"User Question:\n{user_message}\n\nTask:\n{task}\n\n{data_section}"}
        ]