from llm.llm_client import LLMClient

GREETING_RESPONSES = [
    "أهلاً! 👋 إزيك؟ أنا CarAI، فيه إيه؟",
    "هاي! 👋 أنا CarAI، قولي أساعدك بإيه؟",
    "أهلاً أهلاً! 😄 إزيك؟ عايز تعرف إيه عن عربيتك؟",
]

class ResponseGenerator:
    def __init__(self):
        self.llm = LLMClient()

    def generate(self, prompt: str) -> str:
        if prompt == "GREETING_MODE":
            import random
            return random.choice(GREETING_RESPONSES)
        return self.llm.generate(prompt)
