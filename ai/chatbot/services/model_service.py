import requests


class ModelService:
    BASE_URL = "http://localhost:5003/predict"

    def call_unified_api(self, payload: dict):
        try:
            res = requests.post(self.BASE_URL, json=payload)
            return res.json()
        except Exception as e:
            return {"error": str(e)}