from fastapi import APIRouter
from pydantic import BaseModel
from core.chatbot_engine import ChatbotEngine

router = APIRouter(prefix="/chat", tags=["Chat"])

engine = ChatbotEngine()


class ChatRequest(BaseModel):
    user_id: str
    message: str


@router.post("/")
def chat(req: ChatRequest):
    response = engine.handle_message(
        user_id=req.user_id,
        message=req.message
    )
    return {"response": response}