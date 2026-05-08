import requests
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

from config.settings import settings


class LLMClient:

    def generate(self, prompt: str) -> str:
        try:
            res = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "llama-3.1-8b-instant",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 500,
                    "temperature": 0.7
                },
                timeout=30,
                verify=False
            )
            data = res.json()
            if "choices" in data:
                return data["choices"][0]["message"]["content"]
            return f"Groq Error: {data}"
        except Exception as e:
            return f"Error: {str(e)}"