class IntentDetector:
    def detect(self, message: str) -> str:
        msg = message.lower()

        if any(k in msg for k in [
            "latest", "last trip", "آخر رحلة", "الرحلة الاخيرة",
            "قيّم رحلتي", "رحلتي الاخيرة",
            "اخر رحله", "اخر رحلة", "آخر رحله",  # ← أضف دي
            "last", "recent",
        ]):
            return "latest_trip"

        if any(k in msg for k in [
            "week", "weekly", "أسبوع", "أسبوعي", "التقرير", "تقرير",
        ]):
            return "weekly_report"

        if any(k in msg for k in [
            "fuel", "consumption", "بنزين", "وقود", "استهلاك",
        ]):
            return "fuel_analysis"

        if any(k in msg for k in [
            "safe", "safety", "is my driving", "am i driving",
            "driving safe", "risk", "accident",
            "آمن", "أمان", "سلامة", "قيادتي آمنة", "هل قيادتي",
        ]):
            return "safe_driving"

        if any(k in msg for k in [
            "advice", "improve", "tip", "score", "how to",
            "نصيحة", "نصايح", "تحسين", "أحسن", "احسن", "درجة", "ازاي احسن",
        ]):
            return "driving_advice"

        if any(k in msg for k in [
            "health", "vehicle health", "صحة", "عربية", "سيارة",
            "محرك", "فرامل", "إطارات", "هيبوظ", "بوظ", "maintenance",
        ]):
            return "vehicle_health"

        return "general_question"