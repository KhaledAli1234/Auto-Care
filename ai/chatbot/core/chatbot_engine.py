from core.intent_detector import IntentDetector
from services.trip_service import TripService
from services.report_service import ReportService
from services.model_service import ModelService
from core.prompt_builder import PromptBuilder
from core.response_generator import ResponseGenerator


class ChatbotEngine:
    def __init__(self):
        self.intent_detector  = IntentDetector()
        self.trip_service     = TripService()
        self.report_service   = ReportService()
        self.model_service    = ModelService()
        self.prompt_builder   = PromptBuilder()
        self.response_generator = ResponseGenerator()

    def handle_message(self, user_id: str, message: str) -> str:
        intent = self.intent_detector.detect(message)

        if intent == "latest_trip":
            data = self.trip_service.get_latest_trip(user_id)

        elif intent == "weekly_report":
            data = self.report_service.get_weekly_report(user_id)

        elif intent == "vehicle_health":
            trip_data   = self.trip_service.get_latest_trip(user_id)
            # get_vehicle_health بيعمل التحويل والـ call للـ unified API داخلياً
            health_data = self.model_service.get_vehicle_health(trip_data)
            data = {**trip_data, "vehicle_health": health_data}

        elif intent in ["fuel_analysis", "driving_advice"]:
            data = self.trip_service.get_latest_trip(user_id)

        else:
            data = {}

        prompt = self.prompt_builder.build(
            intent=intent,
            user_message=message,
            data=data
        )

        return self.response_generator.generate(prompt)
