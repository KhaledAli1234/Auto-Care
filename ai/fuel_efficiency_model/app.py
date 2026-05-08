from flask import Flask, request, jsonify
import joblib
import pandas as pd
import os

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
model = joblib.load(os.path.join(BASE_DIR, 'models', 'fuel_efficiency_model.pkl'))

FEATURES = [
    'avg_speed', 'max_speed', 'overspeed_ratio', 'speed_variance',
    'trip_duration_min', 'distance_km', 'harsh_brake_count',
    'harsh_accel_count', 'driver_score', 'driver_style',
    'engine_cc', 'weight_kg', 'fuel_combined_l_100km'
]

def get_trend(current, previous):
    diff = (previous - current) / previous * 100
    if diff > 1:
        return "Improving", f"{abs(diff):.1f}% better than last trip"
    elif diff < -1:
        return "Declining", f"{abs(diff):.1f}% worse than last trip"
    else:
        return "Stable", "Same as last trip"

def get_label(actual, base):
    diff = ((actual - base) / base) * 100
    if diff <= 5:    return "Excellent"
    elif diff <= 20: return "Good"
    elif diff <= 40: return "Fair"
    else:            return "Poor"

# ─────────────────────────────────────────
@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json()

        # Validate
        missing = [f for f in FEATURES if f not in data]
        if missing:
            return jsonify({'error': f'Missing fields: {missing}'}), 400

        input_df = pd.DataFrame([{f: data[f] for f in FEATURES}])

        predicted_fuel = round(float(model.predict(input_df)[0]), 2)
        base_fuel      = data['fuel_combined_l_100km']
        previous_fuel  = data.get('previous_fuel_l_100km', None)

        trend, trend_message = (
            get_trend(predicted_fuel, previous_fuel)
            if previous_fuel
            else ("N/A", "No previous trip data")
        )

        label = get_label(predicted_fuel, base_fuel)

        return jsonify({
            'actual_fuel_l_100km' : predicted_fuel,
            'base_fuel_l_100km'   : base_fuel,
            'efficiency_label'    : label,
            'trend'               : trend,
            'trend_message'       : trend_message
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ─────────────────────────────────────────
@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'model': 'fuel_efficiency_v3'})

# ─────────────────────────────────────────
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5002)
