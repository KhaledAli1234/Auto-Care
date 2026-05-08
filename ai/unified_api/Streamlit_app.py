"""
Smart Car AI Assistant — Unified API Tester
Streamlit UI to test all 3 models via the Unified API (port 5003)
"""

import streamlit as st
import requests
import json
import random
import numpy as np

# ── Page Config ───────────────────────────────────────────────────────────
st.set_page_config(
    page_title="Smart Car AI — Unified API Tester",
    page_icon="🚗",
    layout="wide"
)

# ── Custom CSS ────────────────────────────────────────────────────────────
st.markdown("""
<style>
    .main { background-color: #0f1117; }
    .block-container { padding-top: 2rem; }

    .score-card {
        background: linear-gradient(135deg, #1a2744, #243060);
        border: 1px solid #2e4080;
        border-radius: 16px;
        padding: 24px;
        text-align: center;
        margin-bottom: 12px;
    }
    .score-number {
        font-size: 3rem;
        font-weight: 700;
        color: #ffffff;
        line-height: 1;
    }
    .score-label {
        font-size: 0.9rem;
        color: #8899bb;
        margin-top: 6px;
        text-transform: uppercase;
        letter-spacing: 1px;
    }
    .score-status {
        font-size: 1rem;
        font-weight: 600;
        margin-top: 8px;
    }

    .health-bar-wrap {
        background: #1e2535;
        border: 1px solid #2a3550;
        border-radius: 12px;
        padding: 16px 20px;
        margin-bottom: 10px;
    }
    .health-bar-label {
        display: flex;
        justify-content: space-between;
        font-size: 0.85rem;
        color: #aabbcc;
        margin-bottom: 8px;
    }
    .health-bar-bg {
        background: #2a3550;
        border-radius: 6px;
        height: 10px;
        width: 100%;
        overflow: hidden;
    }
    .health-bar-fill {
        height: 10px;
        border-radius: 6px;
        transition: width 0.5s ease;
    }

    .alert-card {
        border-radius: 10px;
        padding: 14px 18px;
        margin-bottom: 10px;
        border-left: 4px solid;
    }
    .alert-critical { background: #2a1515; border-color: #e74c3c; }
    .alert-warning  { background: #2a1f10; border-color: #f39c12; }
    .alert-advisory { background: #1a2515; border-color: #2ecc71; }
    .alert-info     { background: #151f2a; border-color: #3498db; }

    .fuel-card {
        background: #1a2035;
        border: 1px solid #2a3550;
        border-radius: 12px;
        padding: 20px;
        text-align: center;
    }
    .fuel-number {
        font-size: 2.2rem;
        font-weight: 700;
        color: #4fc3f7;
    }
    .fuel-label { font-size: 0.8rem; color: #7788aa; margin-top: 4px; }

    .trend-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 0.8rem;
        font-weight: 600;
        margin-top: 8px;
    }
    .trend-improving { background: #1a3a1a; color: #4caf50; }
    .trend-declining { background: #3a1a1a; color: #ef5350; }
    .trend-stable    { background: #1a2a3a; color: #42a5f5; }

    .section-header {
        font-size: 1.1rem;
        font-weight: 600;
        color: #ccd6f6;
        margin-bottom: 12px;
        padding-bottom: 6px;
        border-bottom: 1px solid #2a3550;
    }
    .api-badge {
        background: #1a2535;
        border: 1px solid #2a4060;
        border-radius: 8px;
        padding: 8px 14px;
        font-family: monospace;
        font-size: 0.85rem;
        color: #64b5f6;
    }
    .elapsed-badge {
        background: #1a2535;
        border: 1px dashed #3a5070;
        border-radius: 8px;
        padding: 6px 14px;
        font-size: 0.8rem;
        color: #7788aa;
        text-align: center;
    }
</style>
""", unsafe_allow_html=True)

UNIFIED_API = "http://127.0.0.1:5003"

# ── Helper: generate dummy sensor arrays ─────────────────────────────────
def make_sensor_array(n=100, style="normal"):
    """Generate realistic accelerometer / gyroscope arrays."""
    arrays = []
    for _ in range(n):
        if style == "aggressive":
            base = random.uniform(9.5, 12.0)
            noise = random.gauss(0, 1.2)
            gx = random.gauss(0, 0.4)
            gy = random.gauss(0, 0.4)
            gz = random.gauss(0, 0.4)
        elif style == "safe":
            base = random.uniform(9.7, 9.9)
            noise = random.gauss(0, 0.08)
            gx = random.gauss(0, 0.02)
            gy = random.gauss(0, 0.02)
            gz = random.gauss(0, 0.02)
        else:  # normal
            base = random.uniform(9.6, 10.2)
            noise = random.gauss(0, 0.4)
            gx = random.gauss(0, 0.12)
            gy = random.gauss(0, 0.12)
            gz = random.gauss(0, 0.12)

        mag = base + noise
        angle = random.uniform(0, 2 * np.pi)
        arrays.append({
            "x": round(mag * np.cos(angle), 4),
            "y": round(mag * np.sin(angle), 4),
            "z": round(noise * 0.3, 4)
        })
    return arrays


def get_bar_color(score):
    if score >= 80: return "#4caf50"
    if score >= 60: return "#ffc107"
    if score >= 40: return "#ff9800"
    return "#ef5350"

def get_status_color(status):
    colors = {
        "Excellent": "#4caf50", "Good": "#8bc34a",
        "Fair": "#ffc107", "Poor": "#ef5350",
        "Risky": "#ff9800", "Aggressive": "#e53935"
    }
    return colors.get(status, "#aaa")

def get_trend_class(trend):
    if trend == "Improving": return "trend-improving"
    if trend == "Declining": return "trend-declining"
    return "trend-stable"

def get_trend_emoji(trend):
    if trend == "Improving": return "↑"
    if trend == "Declining": return "↓"
    return "→"

def get_alert_class(severity):
    return f"alert-{severity.lower()}"

def get_alert_emoji(severity):
    emojis = {"Critical": "🔴", "Warning": "🟠", "Advisory": "🟡", "Info": "🔵"}
    return emojis.get(severity, "⚪")

# ═════════════════════════════════════════════════════════════════════════
# HEADER
# ═════════════════════════════════════════════════════════════════════════
st.markdown("## 🚗 Smart Car AI — Unified API Tester")
st.markdown('<div class="api-badge">POST http://127.0.0.1:5003/predict</div>', unsafe_allow_html=True)
st.markdown("")

# ── Health check ─────────────────────────────────────────────────────────
col_h1, col_h2 = st.columns([1, 3])
with col_h1:
    if st.button("🔍 Check APIs Health", use_container_width=True):
        try:
            r = requests.get(f"{UNIFIED_API}/health", timeout=3)
            data = r.json()
            if data["status"] == "ok":
                st.success("All 3 APIs are running ✅")
            else:
                st.warning("Some APIs are down ⚠️")
                for k, v in data["models"].items():
                    icon = "✅" if v == "ok" else "❌"
                    st.write(f"{icon} {k}: {v}")
        except Exception as e:
            st.error(f"Unified API not reachable: {e}")

st.divider()

# ═════════════════════════════════════════════════════════════════════════
# INPUT PANEL
# ═════════════════════════════════════════════════════════════════════════
with st.expander("⚙️ Trip & Vehicle Inputs", expanded=True):
    col1, col2, col3 = st.columns(3)

    with col1:
        st.markdown('<div class="section-header">🚦 Driving Style (Sensor Simulation)</div>', unsafe_allow_html=True)
        driving_style = st.selectbox(
            "Simulated driving style",
            ["Safe 😊", "Normal 🙂", "Aggressive 😤"],
            index=1,
            help="Controls the simulated accelerometer & gyroscope arrays"
        )
        style_key = driving_style.split()[0].lower()

        st.markdown('<div class="section-header">📍 Trip Data</div>', unsafe_allow_html=True)
        avg_speed       = st.slider("Avg Speed (km/h)", 20, 120, 45)
        max_speed       = st.slider("Max Speed (km/h)", avg_speed, 180, min(avg_speed + 40, 180))
        distance_km     = st.slider("Distance (km)", 1, 100, 25)
        trip_duration   = st.slider("Duration (min)", 5, 120, 35)

    with col2:
        st.markdown('<div class="section-header">📳 Driving Events</div>', unsafe_allow_html=True)
        harsh_brake     = st.slider("Harsh Brakes", 0, 20, 2 if style_key == "normal" else (0 if style_key == "safe" else 8))
        harsh_accel     = st.slider("Harsh Accelerations", 0, 20, 1 if style_key == "normal" else (0 if style_key == "safe" else 6))
        overspeed_ratio = st.slider("Overspeed Ratio", 0.0, 1.0, 0.05 if style_key == "safe" else (0.2 if style_key == "normal" else 0.55), step=0.05)
        speed_variance  = st.slider("Speed Variance", 0.0, 50.0, 5.0 if style_key == "safe" else (15.0 if style_key == "normal" else 35.0))

        prev_fuel = st.number_input("Previous Trip Fuel (L/100km) — optional", min_value=0.0, max_value=30.0, value=0.0, step=0.1)

    with col3:
        st.markdown('<div class="section-header">🔧 Vehicle Specs</div>', unsafe_allow_html=True)
        engine_cc       = st.number_input("Engine CC", min_value=500, max_value=6000, value=2500, step=100)
        engine_power_hp = st.number_input("Engine Power (HP)", min_value=50, max_value=600, value=165, step=5)
        weight_kg       = st.number_input("Weight (kg)", min_value=500, max_value=4000, value=1450, step=50)
        fuel_combined   = st.number_input("Fuel Combined (L/100km)", min_value=3.0, max_value=25.0, value=7.8, step=0.1)
        year            = st.number_input("Year", min_value=1990, max_value=2026, value=2022)

# ═════════════════════════════════════════════════════════════════════════
# PREDICT BUTTON
# ═════════════════════════════════════════════════════════════════════════
st.markdown("")
col_btn1, col_btn2, col_btn3 = st.columns([1, 1, 2])
with col_btn1:
    predict_btn = st.button("🚀 Run All Models", type="primary", use_container_width=True)
with col_btn2:
    show_raw = st.checkbox("Show raw JSON", value=False)

# ═════════════════════════════════════════════════════════════════════════
# RESULTS
# ═════════════════════════════════════════════════════════════════════════
if predict_btn:
    # Build payload
    acc_data  = make_sensor_array(100, style_key)
    gyro_data = make_sensor_array(100, style_key)

    payload = {
        "accelerometer_data": acc_data,
        "gyroscope_data":     gyro_data,
        "avg_speed":          avg_speed,
        "max_speed":          max_speed,
        "overspeed_ratio":    overspeed_ratio,
        "speed_variance":     speed_variance,
        "trip_duration_min":  trip_duration,
        "distance_km":        distance_km,
        "harsh_brake_count":  harsh_brake,
        "harsh_accel_count":  harsh_accel,
        "engine_cc":          engine_cc,
        "engine_power_hp":    engine_power_hp,
        "weight_kg":          weight_kg,
        "fuel_combined_l_100km": fuel_combined,
        "year":               year,
    }
    if prev_fuel > 0:
        payload["previous_fuel_l_100km"] = prev_fuel

    with st.spinner("Calling Unified API..."):
        try:
            resp = requests.post(f"{UNIFIED_API}/predict", json=payload, timeout=15)
            resp.raise_for_status()
            result = resp.json()
        except requests.exceptions.ConnectionError:
            st.error("❌ Cannot reach Unified API on port 5003. Make sure it's running.")
            st.stop()
        except Exception as e:
            st.error(f"❌ Error: {e}")
            st.stop()

    st.markdown("")
    st.markdown(f'<div class="elapsed-badge">⏱ Response time: {result.get("elapsed_seconds", "?")}s</div>', unsafe_allow_html=True)
    st.markdown("")

    # ── Extract sections ──────────────────────────────────────────────
    driver  = result.get("driver_behavior", {})
    health  = result.get("vehicle_health", {})
    fuel    = result.get("fuel_efficiency", {})
    summary = result.get("summary", {})

    # ═══ ROW 1: 3 main scores ════════════════════════════════════════
    st.markdown("### 📊 Results")
    r1c1, r1c2, r1c3 = st.columns(3)

    # Driver Score
    with r1c1:
        d_score  = driver.get("score", 0)
        d_status = driver.get("status", "—")
        d_color  = get_status_color(d_status)
        st.markdown(f"""
        <div class="score-card">
            <div class="score-label">🧑 Driver Score</div>
            <div class="score-number">{d_score:.0f}</div>
            <div class="score-status" style="color:{d_color}">{d_status}</div>
        </div>""", unsafe_allow_html=True)

    # Vehicle Health
    with r1c2:
        vh_score  = health.get("vehicle_health_score", 0) if "error" not in health else 0
        vh_status = health.get("health_status", "—") if "error" not in health else "Error"
        vh_color  = get_status_color(vh_status)
        st.markdown(f"""
        <div class="score-card">
            <div class="score-label">🔧 Vehicle Health</div>
            <div class="score-number">{vh_score:.0f}</div>
            <div class="score-status" style="color:{vh_color}">{vh_status}</div>
        </div>""", unsafe_allow_html=True)

    # Fuel
    with r1c3:
        f_val   = fuel.get("actual_fuel_l_100km", 0) if "error" not in fuel else 0
        f_label = fuel.get("efficiency_label", "—") if "error" not in fuel else "Error"
        f_trend = fuel.get("trend", "Stable") if "error" not in fuel else "—"
        f_msg   = fuel.get("trend_message", "") if "error" not in fuel else ""
        f_color = get_status_color(f_label)
        t_class = get_trend_class(f_trend)
        t_emoji = get_trend_emoji(f_trend)
        st.markdown(f"""
        <div class="score-card">
            <div class="score-label">⛽ Fuel Efficiency</div>
            <div class="fuel-number">{f_val} L/100km</div>
            <div class="score-status" style="color:{f_color}">{f_label}</div>
            <div><span class="trend-badge {t_class}">{t_emoji} {f_trend}</span></div>
            <div style="font-size:0.75rem;color:#7788aa;margin-top:6px">{f_msg}</div>
        </div>""", unsafe_allow_html=True)

    st.markdown("")

    # ═══ ROW 2: Component Health bars + Alerts ════════════════════════
    r2c1, r2c2 = st.columns([1, 1])

    with r2c1:
        st.markdown('<div class="section-header">🔩 Component Health</div>', unsafe_allow_html=True)
        if "error" not in health:
            components = health.get("components", {})
            for name, icon in [("engine", "⚙️"), ("brakes", "🛑"), ("tires", "🔴")]:
                comp = components.get(name, {})
                score  = comp.get("health", 0)
                status = comp.get("status", "—")
                color  = get_bar_color(score)
                st.markdown(f"""
                <div class="health-bar-wrap">
                    <div class="health-bar-label">
                        <span>{icon} {name.capitalize()} — {status}</span>
                        <span style="color:{color};font-weight:600">{score}/100</span>
                    </div>
                    <div class="health-bar-bg">
                        <div class="health-bar-fill" style="width:{score}%;background:{color}"></div>
                    </div>
                </div>""", unsafe_allow_html=True)

            risk = health.get("maintenance_risk", "—")
            risk_colors = {"Low": "#4caf50", "Medium": "#ffc107", "High": "#ff9800", "Critical": "#ef5350"}
            risk_color = risk_colors.get(risk, "#aaa")
            st.markdown(f"""
            <div style="text-align:center;padding:10px;background:#1a2035;border-radius:10px;border:1px solid #2a3550">
                <span style="color:#8899bb;font-size:0.8rem">Maintenance Risk</span><br>
                <span style="color:{risk_color};font-size:1.3rem;font-weight:700">{risk}</span>
            </div>""", unsafe_allow_html=True)
        else:
            st.error(f"Vehicle Health API error: {health.get('error')}")

    with r2c2:
        st.markdown('<div class="section-header">🚨 Maintenance Alerts</div>', unsafe_allow_html=True)
        if "error" not in health:
            alerts = health.get("alerts", [])
            if alerts:
                for alert in alerts:
                    severity = alert.get("severity", "Info")
                    a_class  = get_alert_class(severity)
                    a_emoji  = get_alert_emoji(severity)
                    st.markdown(f"""
                    <div class="alert-card {a_class}">
                        <div style="font-weight:600;color:#ccd6f6;margin-bottom:4px">
                            {a_emoji} {alert.get('component')} — {severity}
                            <span style="float:right;color:#7788aa;font-size:0.8rem">{alert.get('health_score')}/100</span>
                        </div>
                        <div style="color:#aabbcc;font-size:0.85rem">{alert.get('message')}</div>
                    </div>""", unsafe_allow_html=True)
            else:
                st.markdown("""
                <div class="alert-card" style="background:#1a2a1a;border-left:4px solid #4caf50">
                    <div style="color:#4caf50;font-weight:600">✅ All components healthy</div>
                    <div style="color:#7788aa;font-size:0.85rem">No maintenance alerts at this time.</div>
                </div>""", unsafe_allow_html=True)
        else:
            st.error(f"Vehicle Health API error: {health.get('error')}")

    # ═══ ROW 3: Raw JSON ══════════════════════════════════════════════
    if show_raw:
        st.markdown("")
        st.markdown('<div class="section-header">📄 Raw API Response</div>', unsafe_allow_html=True)
        st.json(result)