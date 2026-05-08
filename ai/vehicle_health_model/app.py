"""
Vehicle Health Model - Flask API
Step 1: REST API endpoint for Vehicle Health Prediction
"""

from flask import Flask, request, jsonify
import joblib
import pandas as pd
import numpy as np
import os

app = Flask(__name__)

# ── تحميل الموديل لمرة واحدة عند بدء السيرفر ──────────────────────────────
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'models', 'vehicle_health_model.pkl')
model = joblib.load(MODEL_PATH)

# ── الـ Features بنفس الترتيب اللي اتدرب عليه الموديل ────────────────────
FEATURE_COLUMNS = [
    # GPS sensor
    'avg_speed',
    'max_speed',
    'overspeed_ratio',
    'speed_variance',
    'trip_duration_min',
    'distance_km',
    # Accelerometer sensor
    'harsh_brake_count',
    'harsh_accel_count',
    # Driver Model output (Model 1)
    'driver_score',
    'driver_style',
    # Vehicle specs (manual)
    'engine_cc',
    'engine_power_hp',
    'weight_kg',
    'fuel_combined_l_100km',
    'year',
]

# Encode driver_style → رقم
STYLE_MAP = {
    'Safe': 2,
    'Normal': 1,
    'Aggressive': 0
}

# ── Maintenance Risk Classification ──────────────────────────────────────
def get_maintenance_risk(health_score: float) -> str:
    if health_score >= 80:
        return 'Low'
    elif health_score >= 60:
        return 'Medium'
    elif health_score >= 40:
        return 'High'
    else:
        return 'Critical'

# ── Health Score إلى حالة مقروءة ─────────────────────────────────────────
def get_health_status(score: float) -> str:
    if score >= 80:
        return 'Excellent'
    elif score >= 60:
        return 'Good'
    elif score >= 40:
        return 'Fair'
    else:
        return 'Poor'

# ── Alerts بناءً على component health ────────────────────────────────────
def generate_alerts(engine: float, brake: float, tire: float) -> list:
    alerts = []
    if engine < 40:
        alerts.append({'component': 'Engine', 'severity': 'Critical', 'message': 'Engine requires immediate inspection.'})
    elif engine < 60:
        alerts.append({'component': 'Engine', 'severity': 'Warning', 'message': 'Engine showing signs of wear.'})

    if brake < 40:
        alerts.append({'component': 'Brakes', 'severity': 'Critical', 'message': 'Brake system requires immediate attention.'})
    elif brake < 60:
        alerts.append({'component': 'Brakes', 'severity': 'Warning', 'message': 'Brake pads may need replacement soon.'})

    if tire < 40:
        alerts.append({'component': 'Tires', 'severity': 'Critical', 'message': 'Tires are critically worn. Replace immediately.'})
    elif tire < 60:
        alerts.append({'component': 'Tires', 'severity': 'Warning', 'message': 'Tire wear is above normal levels.'})

    return alerts


# ══════════════════════════════════════════════════════════════════════════
# Endpoint: /predict-health
# Method  : POST
# Input   : JSON (trip data + driver model output + vehicle specs)
# Output  : JSON (component health + overall score + risk + alerts)
# ══════════════════════════════════════════════════════════════════════════

@app.route('/predict-health', methods=['POST'])
def predict_health():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No JSON data received'}), 400

        # ── Validate required fields ──────────────────────────────────────
        required_fields = [
            'avg_speed', 'max_speed', 'harsh_brake_count', 'harsh_accel_count',
            'overspeed_ratio', 'speed_variance', 'trip_duration_min', 'distance_km',
            'driver_score', 'driver_style',
            'engine_cc', 'engine_power_hp', 'weight_kg', 'fuel_combined_l_100km', 'year'
        ]
        missing = [f for f in required_fields if f not in data]
        if missing:
            return jsonify({'error': f'Missing fields: {missing}'}), 400

        # ── Encode driver_style ───────────────────────────────────────────
        driver_style_raw = data.get('driver_style', 'Normal')
        driver_style_encoded = STYLE_MAP.get(driver_style_raw, 1)

        # ── Build features DataFrame ──────────────────────────────────────
        features = {
            'avg_speed':             float(data['avg_speed']),
            'max_speed':             float(data['max_speed']),
            'harsh_brake_count':     float(data['harsh_brake_count']),
            'harsh_accel_count':     float(data['harsh_accel_count']),
            'overspeed_ratio':       float(data['overspeed_ratio']),
            'speed_variance':        float(data['speed_variance']),
            'trip_duration_min':     float(data['trip_duration_min']),
            'distance_km':           float(data['distance_km']),
            'driver_score':          float(data['driver_score']),
            'driver_style':          driver_style_encoded,
            'engine_cc':             float(data['engine_cc']),
            'engine_power_hp':       float(data['engine_power_hp']),
            'weight_kg':             float(data['weight_kg']),
            'fuel_combined_l_100km': float(data['fuel_combined_l_100km']),
            'year':                  int(data['year']),
        }

        features_df = pd.DataFrame([features])[FEATURE_COLUMNS]

        # ── Predict ───────────────────────────────────────────────────────
        predictions = model.predict(features_df)[0]

        engine_health = round(float(np.clip(predictions[0], 0, 100)), 1)
        brake_health  = round(float(np.clip(predictions[1], 0, 100)), 1)
        tire_health   = round(float(np.clip(predictions[2], 0, 100)), 1)

        # ── Overall vehicle health score ──────────────────────────────────
        vehicle_health_score = round((engine_health + brake_health + tire_health) / 3, 1)

        # ── Risk & Status ─────────────────────────────────────────────────
        maintenance_risk = get_maintenance_risk(vehicle_health_score)
        health_status    = get_health_status(vehicle_health_score)

        # ── Alerts ────────────────────────────────────────────────────────
        alerts = generate_alerts(engine_health, brake_health, tire_health)

        # ── Final Response ────────────────────────────────────────────────
        response = {
            'vehicle_health_score': vehicle_health_score,
            'health_status':        health_status,
            'maintenance_risk':     maintenance_risk,
            'components': {
                'engine': {'health': engine_health, 'status': get_health_status(engine_health)},
                'brakes': {'health': brake_health,  'status': get_health_status(brake_health)},
                'tires':  {'health': tire_health,   'status': get_health_status(tire_health)},
            },
            'alerts': alerts
        }

        return jsonify(response), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Health Check Endpoint ─────────────────────────────────────────────────
@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'running', 'model': 'vehicle_health_v1'}), 200


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)