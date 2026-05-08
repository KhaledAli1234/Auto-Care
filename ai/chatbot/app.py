from flask import Flask, request, jsonify
from core.chatbot_engine import ChatbotEngine

app = Flask(__name__)
engine = ChatbotEngine()


@app.route("/", methods=["GET"])
def home():
    return jsonify({"message": "Chatbot API running"})


@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json()

    if not data:
        return jsonify({"error": "No JSON body sent"}), 400

    user_id = data.get("user_id")
    message = data.get("message")

    if not user_id or not message:
        return jsonify({"error": "user_id and message are required"}), 400

    response = engine.handle_message(user_id, message)
    return jsonify({"response": response})


if __name__ == "__main__":
    app.run(debug=False, host='0.0.0.0', port=8000)
