from flask import Blueprint, request, jsonify
from core.chatbot_engine import ChatbotEngine

chat_bp = Blueprint("chat", __name__)
engine = ChatbotEngine()

@chat_bp.route("/chat", methods=["POST"])
def chat():
    data = request.get_json()

    if not data:
        return jsonify({"error": "No JSON body sent"}), 400

    user_id = data.get("user_id")
    message = data.get("message")
    history = data.get("history", [])

    if not user_id or not message:
        return jsonify({"error": "user_id and message are required"}), 400

    response = engine.handle_message(user_id, message, history)
    return jsonify({"response": response})