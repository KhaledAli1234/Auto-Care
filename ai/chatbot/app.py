from flask import Flask, jsonify
from flask_cors import CORS
from routes.chat_routes import chat_bp

app = Flask(name)
CORS(app)
app.register_blueprint(chat_bp)

@app.route("/", methods=["GET"])
def home():
    return jsonify({"message": "Chatbot API running"})

if name == "main":
    app.run(debug=False, host='0.0.0.0', port=8000)