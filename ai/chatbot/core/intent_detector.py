class IntentDetector:

    def detect(self, message: str) -> str:
        msg = message.lower()

        # Latest trip — عربي + إنجليزي
        if any(k in msg for k in ["latest", "last trip", "آخر رحلة", "الرحلة الاخيرة", "قيّم رحلتي", "رحلتي الاخيرة"]):
            return "latest_trip"

        # Weekly report
        if any(k in msg for k in ["week", "weekly", "أسبوع", "أسبوعي", "التقرير"]):
            return "weekly_report"

        # Fuel
        if any(k in msg for k in ["fuel", "consumption", "بنزين", "وقود", "استهلاك"]):
            return "fuel_analysis"

        # Vehicle health
        if any(k in msg for k in ["health", "car", "صحة", "عربية", "سيارة", "محرك", "فرامل", "إطارات", "هيبوظ", "بوظ"]):
            return "vehicle_health"

        # Driving advice
        if any(k in msg for k in ["advice", "improve", "tip", "نصيحة", "نصايح", "تحسين", "أحسن"]):
            return "driving_advice"

        return "general_question"