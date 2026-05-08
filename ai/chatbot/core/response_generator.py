from llm.llm_client import LLMClient


class ResponseGenerator:
    def __init__(self):
        self.llm = LLMClient()

    def generate(self, prompt: str) -> str:
        return self.llm.generate(prompt)