from flask import Flask, request, jsonify
import requests
import concurrent.futures
import time

app = Flask(__name__)

# ─── Model APIs ───────────────────────────────────────────────
MODEL1_URL = "http://smart_driving_driver:5000/predict"
MODEL2_URL = "http://smart_driving_vehicle:5001/predict-health"
MODEL3_URL = "http://smart_driving_fuel:5002/predict"

TIMEOUT = 10  # seconds per request


# ─── Input Validation ─────────────────────────────────────────
REQUIRED_FIELDS = [
    "avg_speed", "max_speed", "overspeed_ratio", "speed_variance",
    "trip_duration_min", "distance_km",
    "accelerometer_data", "gyroscope_data",
    "engine_cc", "engine_power_hp", "weight_kg",
    "fuel_combined_l_100km", "year",
    "harsh_brake_count", "harsh_accel_count",
]

# ─── Style Maps ───────────────────────────────────────────────
STYLE_MAP_ENCODE = {"Aggressive": 0, "Normal": 1, "Safe": 2}
STYLE_MAP_DECODE = {0: "Aggressive", 1: "Normal", 2: "Safe"}


# ─── Build payloads ────────────────────────────────────────────
def build_model1_payload(data):
    return {
        "accelerometer_data": data["accelerometer_data"],
        "gyroscope_data":     data["gyroscope_data"],
    }


def build_model2_payload(data, driver_score, driver_style):
    """Model 2 بياخد driver_style كـ STRING (Safe/Normal/Aggressive)"""
    return {
        "avg_speed":             data["avg_speed"],
        "max_speed":             data["max_speed"],
        "overspeed_ratio":       data["overspeed_ratio"],
        "speed_variance":        data["speed_variance"],
        "trip_duration_min":     data["trip_duration_min"],
        "distance_km":           data["distance_km"],
        "harsh_brake_count":     data["harsh_brake_count"],
        "harsh_accel_count":     data["harsh_accel_count"],
        "driver_score":          driver_score,
        "driver_style":          driver_style,
        "engine_cc":             data["engine_cc"],
        "engine_power_hp":       data["engine_power_hp"],
        "weight_kg":             data["weight_kg"],
        "fuel_combined_l_100km": data["fuel_combined_l_100km"],
        "year":                  data["year"],
    }


def build_model3_payload(data, driver_score, driver_style):
    """Model 3 بياخد driver_style كـ INT (0=Aggressive, 1=Normal, 2=Safe)"""
    driver_style_encoded = STYLE_MAP_ENCODE.get(driver_style, 1)

    payload = {
        "avg_speed":             data["avg_speed"],
        "max_speed":             data["max_speed"],
        "overspeed_ratio":       data["overspeed_ratio"],
        "speed_variance":        data["speed_variance"],
        "trip_duration_min":     data["trip_duration_min"],
        "distance_km":           data["distance_km"],
        "harsh_brake_count":     data["harsh_brake_count"],
        "harsh_accel_count":     data["harsh_accel_count"],
        "driver_score":          driver_score,
        "driver_style":          driver_style_encoded,
        "engine_cc":             data["engine_cc"],
        "weight_kg":             data["weight_kg"],
        "fuel_combined_l_100km": data["fuel_combined_l_100km"],
    }
    if data.get("previous_fuel_l_100km") is not None:
        payload["previous_fuel_l_100km"] = data["previous_fuel_l_100km"]
    return payload


# ─── Call helper ──────────────────────────────────────────────
def call_model(url, payload, name):
    try:
        resp = requests.post(url, json=payload, timeout=TIMEOUT)
        resp.raise_for_status()
        return name, resp.json()
    except requests.exceptions.ConnectionError:
        return name, {"error": f"{name} API is not running"}
    except requests.exceptions.Timeout:
        return name, {"error": f"{name} API timed out"}
    except Exception as e:
        return name, {"error": str(e)}


# ─── Main Endpoint ─────────────────────────────────────────────
@app.route("/predict", methods=["POST"])
def unified_predict():
    start = time.time()
    data = request.get_json()

    if not data:
        return jsonify({"error": "No JSON received"}), 400

    missing = [f for f in REQUIRED_FIELDS if f not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {missing}"}), 400

    # ── Step 1: Model 1 ───────────────────────────────────────
    _, m1_result = call_model(
        MODEL1_URL,
        build_model1_payload(data),
        "driver_behavior"
    )

    if "error" in m1_result:
        return jsonify({
            "error": "Model 1 failed — cannot proceed",
            "detail": m1_result["error"]
        }), 502

    # ── Parse Model 1 output ──────────────────────────────────
    driver_score = (
        m1_result.get("score") or
        m1_result.get("driver_score") or
        50
    )

    driver_style_raw = (
        m1_result.get("driver_style") or
        m1_result.get("driver_style_encoded") or
        1
    )

    # تأكد إن driver_style دايماً string
    if isinstance(driver_style_raw, int):
        driver_style = STYLE_MAP_DECODE.get(driver_style_raw, "Normal")
    else:
        driver_style = driver_style_raw

    # ── Step 2: Model 2 & 3 موازياً ──────────────────────────
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        future_m2 = executor.submit(
            call_model,
            MODEL2_URL,
            build_model2_payload(data, driver_score, driver_style),
            "vehicle_health"
        )
        future_m3 = executor.submit(
            call_model,
            MODEL3_URL,
            build_model3_payload(data, driver_score, driver_style),
            "fuel_efficiency"
        )

        _, m2_result = future_m2.result()
        _, m3_result = future_m3.result()

    print("DEBUG M1:", m1_result)
    print("DEBUG M2:", m2_result)
    print("DEBUG M3:", m3_result)

    elapsed = round(time.time() - start, 3)

    # ── Safe component extraction ─────────────────────────────
    components = (
        m2_result.get("components", {})
        if "error" not in m2_result
        else {}
    )

    # ── Response ──────────────────────────────────────────────
    return jsonify({
        "status": "ok",
        "elapsed_seconds": elapsed,

        "driver_behavior": {
            "score":      driver_score,
            "status":     m1_result.get("status"),
            "confidence": m1_result.get("confidence"),
        },

        "vehicle_health":  m2_result,
        "fuel_efficiency": m3_result,

        "summary": {
            "driver_score":  driver_score,
            "driver_status": m1_result.get("status"),

            "vehicle_health_score": (
                m2_result.get("vehicle_health_score")
                if "error" not in m2_result else None
            ),
            "engine_health": components.get("engine", {}).get("health"),
            "brake_health":  components.get("brakes", {}).get("health"),
            "tire_health":   components.get("tires",  {}).get("health"),

            "maintenance_alerts": (
                m2_result.get("alerts", [])
                if "error" not in m2_result else []
            ),

            "fuel_l_100km": (
                m3_result.get("actual_fuel_l_100km")
                if "error" not in m3_result else None
            ),
            "fuel_trend": (
                m3_result.get("trend")
                if "error" not in m3_result else None
            ),
            "fuel_label": (
                m3_result.get("efficiency_label")
                if "error" not in m3_result else None
            ),
        }
    })


# ─── Health Check ──────────────────────────────────────────────
@app.route("/health", methods=["GET"])
def health():
    checks = {}
    urls = {
        "model1_driver_behavior": MODEL1_URL.replace("/predict", "/health"),
        "model2_vehicle_health":  MODEL2_URL.replace("/predict-health", "/health"),
        "model3_fuel_efficiency": MODEL3_URL.replace("/predict", "/health"),
    }

    for name, url in urls.items():
        try:
            r = requests.get(url, timeout=3)
            checks[name] = "ok" if r.status_code == 200 else "error"
        except Exception:
            checks[name] = "unreachable"

    all_ok = all(v == "ok" for v in checks.values())

    return jsonify({
        "status": "ok" if all_ok else "degraded",
        "models": checks
    }), 200 if all_ok else 207


# ─── Run ───────────────────────────────────────────────────────
if __name__ == "__main__":
    print("🚀 Unified API running on port 5003")
    print("   POST /predict  — run all 3 models")
    print("   GET  /health   — check all models")
    app.run(host='0.0.0.0', port=5003, debug=True)