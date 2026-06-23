from llm.llm_client import LLMClient


class ResponseGenerator:
    def __init__(self):
        self.llm = LLMClient()

    def generate(self, messages) -> str:
        if isinstance(messages, str):
            messages = [{"role": "user", "content": messages}]
        return self.llm.generate(messages)