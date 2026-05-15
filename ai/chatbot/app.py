from flask import Flask, jsonify
from flask_cors import CORS
from routes.chat_routes import chat_bp

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=False)
app.register_blueprint(chat_bp)

@app.route("/", methods=["GET"])
def home():
    return jsonify({"message": "Chatbot API running"})

if __name__ == "__main__":
    app.run(debug=False, host='0.0.0.0', port=8000)