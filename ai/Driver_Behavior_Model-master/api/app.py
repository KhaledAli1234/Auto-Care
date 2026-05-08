"""
Driver Behavior Model — Flask API
Port: 5000
"""

from flask import Flask, request, jsonify
import sys
import os

# ── Fix import path ──────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SRC_DIR  = os.path.join(BASE_DIR, '..', 'src')
sys.path.insert(0, SRC_DIR)

from pipeline import DriverPipeline

app = Flask(__name__)

# ── Load Pipeline ─────────────────────────────────────────────────────────
MODEL_PATH = os.path.join(BASE_DIR, '..', 'models', 'driver_model_v2.pkl')
pipeline   = DriverPipeline(MODEL_PATH)

# ── Style → score & status mapping ───────────────────────────────────────
STYLE_SCORE_MAP = {
    'Safe':       {'score': 90, 'status': 'Excellent'},
    'Normal':     {'score': 70, 'status': 'Good'},
    'Aggressive': {'score': 40, 'status': 'Risky'},
}


# ══════════════════════════════════════════════════════════════════════════
# Endpoint: /predict
# ══════════════════════════════════════════════════════════════════════════

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No JSON data received'}), 400

        # ── التعديل هنا: سحب البيانات بأي مسمى مبعوت (مختصر أو طويل) ──────
        acc_list  = data.get('acc') or data.get('accelerometer_data')
        gyro_list = data.get('gyro') or data.get('gyroscope_data')

        # التأكد إن البيانات مش None
        if acc_list is None or gyro_list is None:
            return jsonify({'error': 'Missing accelerometer or gyroscope data'}), 400

        # ── التعديل هنا: تقليل شرط الـ 10 قراءات لـ 1 عشان التجربة تشتغل ──
        if len(acc_list) < 1 or len(gyro_list) < 1:
            return jsonify({'error': 'Sensor arrays are empty'}), 400

        # ── Predict via Pipeline ──────────────────────────────────────────
        score, status = pipeline.predict_score(acc_list, gyro_list)

        # ── Map status → driver_style ─────────────────────────────────────
        STATUS_TO_STYLE = {
            'Excellent': 'Safe',
            'Good':      'Normal',
            'Risky':     'Aggressive',
            'Poor':      'Aggressive',
        }
        driver_style = STATUS_TO_STYLE.get(status, 'Normal')

        # ── Confidence calculation ───────────────────────────────────────
        confidence = getattr(pipeline, 'last_confidence', None)
        if confidence is None:
            if score >= 85 or score <= 45:
                confidence = 90.0
            else:
                confidence = 75.0

        return jsonify({
            'score':               round(float(score), 1),
            'driver_score':        round(float(score), 1),
            'driver_style':        driver_style,
            'status':              status,
            'confidence':          round(float(confidence), 1),
            'message':             f'Driving is {status}',
        }), 200

    except Exception as e:
        # طباعة الخطأ في الـ Terminal عشان تعرف لو فيه حاجة تانية باظت
        print(f"❌ Error during prediction: {str(e)}")
        return jsonify({'error': str(e)}), 500


# ── Health Check ──────────────────────────────────────────────────────────
@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'running', 'model': 'driver_behavior_v2'}), 200


if __name__ == '__main__':
    # تأكد إنك شغال على بورت 5000
    app.run(debug=True, host='0.0.0.0', port=5000)