import streamlit as st
import joblib
import pandas as pd
import os

# ─── Page Config ───────────────────────────────────────────────
st.set_page_config(
    page_title="Fuel Efficiency Predictor",
    page_icon="⛽",
    layout="wide"
)

# ─── Custom CSS ────────────────────────────────────────────────
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;600;800&display=swap');

html, body, [class*="css"] {
    font-family: 'Syne', sans-serif;
    background-color: #0d1117;
    color: #e6edf3;
}

.main { background-color: #0d1117; }

/* Header */
.hero {
    background: linear-gradient(135deg, #1a2332 0%, #0d1117 50%, #1a2332 100%);
    border: 1px solid #21262d;
    border-radius: 16px;
    padding: 40px;
    margin-bottom: 32px;
    text-align: center;
    position: relative;
    overflow: hidden;
}
.hero::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(circle at 50% 50%, rgba(33, 150, 243, 0.05) 0%, transparent 60%);
    pointer-events: none;
}
.hero h1 {
    font-size: 2.8rem;
    font-weight: 800;
    background: linear-gradient(90deg, #58a6ff, #79c0ff);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin: 0;
    letter-spacing: -1px;
}
.hero p {
    color: #8b949e;
    font-size: 1rem;
    margin-top: 8px;
    font-family: 'Space Mono', monospace;
}

/* Section Headers */
.section-title {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: #58a6ff;
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 1px solid #21262d;
}

/* Result Cards */
.result-card {
    background: #161b22;
    border: 1px solid #21262d;
    border-radius: 12px;
    padding: 28px;
    text-align: center;
    margin-bottom: 16px;
}
.result-main {
    font-size: 3.5rem;
    font-weight: 800;
    font-family: 'Space Mono', monospace;
    color: #58a6ff;
    line-height: 1;
}
.result-unit {
    font-size: 1rem;
    color: #8b949e;
    margin-top: 4px;
    font-family: 'Space Mono', monospace;
}
.result-label {
    font-size: 0.75rem;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #8b949e;
    margin-bottom: 12px;
}

/* Trend Badge */
.trend-improving {
    background: rgba(63, 185, 80, 0.15);
    color: #3fb950;
    border: 1px solid rgba(63, 185, 80, 0.3);
    padding: 8px 20px;
    border-radius: 100px;
    font-size: 0.85rem;
    font-weight: 600;
    display: inline-block;
    margin-top: 12px;
}
.trend-declining {
    background: rgba(248, 81, 73, 0.15);
    color: #f85149;
    border: 1px solid rgba(248, 81, 73, 0.3);
    padding: 8px 20px;
    border-radius: 100px;
    font-size: 0.85rem;
    font-weight: 600;
    display: inline-block;
    margin-top: 12px;
}
.trend-stable {
    background: rgba(210, 153, 34, 0.15);
    color: #d29922;
    border: 1px solid rgba(210, 153, 34, 0.3);
    padding: 8px 20px;
    border-radius: 100px;
    font-size: 0.85rem;
    font-weight: 600;
    display: inline-block;
    margin-top: 12px;
}
.trend-na {
    background: rgba(139, 148, 158, 0.15);
    color: #8b949e;
    border: 1px solid rgba(139, 148, 158, 0.3);
    padding: 8px 20px;
    border-radius: 100px;
    font-size: 0.85rem;
    display: inline-block;
    margin-top: 12px;
}

/* Label Badge */
.label-excellent { color: #3fb950; font-size: 1.1rem; font-weight: 700; margin-top: 8px; }
.label-good      { color: #58a6ff; font-size: 1.1rem; font-weight: 700; margin-top: 8px; }
.label-fair      { color: #d29922; font-size: 1.1rem; font-weight: 700; margin-top: 8px; }
.label-poor      { color: #f85149; font-size: 1.1rem; font-weight: 700; margin-top: 8px; }

/* Metric Boxes */
.metric-box {
    background: #161b22;
    border: 1px solid #21262d;
    border-radius: 10px;
    padding: 16px 20px;
    margin-bottom: 10px;
}
.metric-box .metric-val {
    font-family: 'Space Mono', monospace;
    font-size: 1.4rem;
    font-weight: 700;
    color: #e6edf3;
}
.metric-box .metric-lbl {
    font-size: 0.72rem;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #8b949e;
}

/* Sliders & Inputs */
.stSlider > div > div > div > div { background: #58a6ff !important; }
div[data-testid="stNumberInput"] input {
    background: #161b22 !important;
    border: 1px solid #21262d !important;
    color: #e6edf3 !important;
    border-radius: 8px !important;
}

/* Button */
div[data-testid="stButton"] > button {
    background: linear-gradient(135deg, #1f6feb, #388bfd) !important;
    color: white !important;
    border: none !important;
    border-radius: 10px !important;
    padding: 14px 0 !important;
    font-size: 1rem !important;
    font-weight: 700 !important;
    font-family: 'Syne', sans-serif !important;
    letter-spacing: 1px !important;
    width: 100% !important;
    transition: opacity 0.2s !important;
}
div[data-testid="stButton"] > button:hover { opacity: 0.85 !important; }

/* Divider */
hr { border-color: #21262d !important; }
</style>
""", unsafe_allow_html=True)

# ─── Load Model ────────────────────────────────────────────────
@st.cache_resource
def load_model():
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    return joblib.load(os.path.join(BASE_DIR, 'models', 'fuel_efficiency_model.pkl'))

model = load_model()

# ─── Helper Functions ──────────────────────────────────────────
def get_trend(current, previous):
    diff = (previous - current) / previous * 100
    if diff > 1:
        return "Improving", f"▲ {abs(diff):.1f}% better than last trip", "improving"
    elif diff < -1:
        return "Declining", f"▼ {abs(diff):.1f}% worse than last trip", "declining"
    else:
        return "Stable", "→ Same as last trip", "stable"

def get_label(actual, base):
    diff = ((actual - base) / base) * 100
    if diff <= 5:    return "Excellent", "excellent"
    elif diff <= 20: return "Good", "good"
    elif diff <= 40: return "Fair", "fair"
    else:            return "Poor", "poor"

# ─── Hero ──────────────────────────────────────────────────────
st.markdown("""
<div class="hero">
    <h1>⛽ Fuel Efficiency Predictor</h1>
    <p>Smart Car AI Assistant — Model 3</p>
</div>
""", unsafe_allow_html=True)

# ─── Layout ────────────────────────────────────────────────────
left, right = st.columns([1.2, 1], gap="large")

with left:
    # Trip Data
    st.markdown('<div class="section-title">📡 Trip Data</div>', unsafe_allow_html=True)
    c1, c2 = st.columns(2)
    with c1:
        avg_speed       = st.slider("Avg Speed (km/h)",       10, 150, 60)
        max_speed       = st.slider("Max Speed (km/h)",        avg_speed, 200, 100)
        trip_duration   = st.slider("Duration (min)",          5, 180, 30)
        distance_km     = st.slider("Distance (km)",           1, 200, 25)
    with c2:
        overspeed_ratio = st.slider("Overspeed Ratio",         0.0, 1.0, 0.05, step=0.01)
        speed_variance  = st.slider("Speed Variance",          0.0, 50.0, 8.0, step=0.5)
        harsh_brake     = st.slider("Harsh Brakes",            0, 20, 1)
        harsh_accel     = st.slider("Harsh Accelerations",     0, 20, 1)

    st.markdown("<br>", unsafe_allow_html=True)

    # Driver Info
    st.markdown('<div class="section-title">👤 Driver Info</div>', unsafe_allow_html=True)
    c3, c4 = st.columns(2)
    with c3:
        driver_score = st.slider("Driver Score", 0, 100, 80)
    with c4:
        driver_style = st.selectbox("Driver Style",
                                    options=[0, 1, 2],
                                    format_func=lambda x: {0:"🔴 Aggressive", 1:"🟡 Normal", 2:"🟢 Safe"}[x],
                                    index=1)

    st.markdown("<br>", unsafe_allow_html=True)

    # Vehicle Specs
    st.markdown('<div class="section-title">🚘 Vehicle Specs</div>', unsafe_allow_html=True)
    c5, c6, c7 = st.columns(3)
    with c5:
        engine_cc   = st.number_input("Engine CC",    500,  6000, 1600, step=100)
    with c6:
        weight_kg   = st.number_input("Weight (kg)",  500,  4000, 1300, step=50)
    with c7:
        base_fuel   = st.number_input("Base Fuel (L/100km)", 3.0, 20.0, 7.0, step=0.1)

    st.markdown("<br>", unsafe_allow_html=True)

    # Previous Trip
    st.markdown('<div class="section-title">🔄 Comparison</div>', unsafe_allow_html=True)
    has_previous = st.checkbox("Compare with last trip", value=True)
    previous_fuel = None
    if has_previous:
        previous_fuel = st.slider("Last Trip Fuel (L/100km)", 3.0, 25.0, 8.5, step=0.1)

    st.markdown("<br>", unsafe_allow_html=True)
    predict_btn = st.button("⚡ PREDICT FUEL EFFICIENCY")

# ─── Results ───────────────────────────────────────────────────
with right:
    st.markdown('<div class="section-title">📊 Results</div>', unsafe_allow_html=True)

    if predict_btn:
        input_df = pd.DataFrame([{
            'avg_speed'            : avg_speed,
            'max_speed'            : max_speed,
            'overspeed_ratio'      : overspeed_ratio,
            'speed_variance'       : speed_variance,
            'trip_duration_min'    : trip_duration,
            'distance_km'          : distance_km,
            'harsh_brake_count'    : harsh_brake,
            'harsh_accel_count'    : harsh_accel,
            'driver_score'         : driver_score,
            'driver_style'         : driver_style,
            'engine_cc'            : engine_cc,
            'weight_kg'            : weight_kg,
            'fuel_combined_l_100km': base_fuel,
        }])

        predicted = round(float(model.predict(input_df)[0]), 2)
        label_text, label_cls = get_label(predicted, base_fuel)
        diff_pct = ((predicted - base_fuel) / base_fuel) * 100

        # Main Result
        st.markdown(f"""
        <div class="result-card">
            <div class="result-label">Actual Fuel Consumption</div>
            <div class="result-main">{predicted}</div>
            <div class="result-unit">L / 100km</div>
            <div class="label-{label_cls}">{label_text}</div>
        </div>
        """, unsafe_allow_html=True)

        # Trend
        if previous_fuel:
            trend, msg, cls = get_trend(predicted, previous_fuel)
            st.markdown(f"""
            <div class="result-card">
                <div class="result-label">vs Last Trip</div>
                <div class="trend-{cls}">{msg}</div>
            </div>
            """, unsafe_allow_html=True)
        else:
            st.markdown("""
            <div class="result-card">
                <div class="result-label">vs Last Trip</div>
                <div class="trend-na">No previous trip data</div>
            </div>
            """, unsafe_allow_html=True)

        # Breakdown
        st.markdown('<div class="section-title" style="margin-top:24px">🔍 Breakdown</div>', unsafe_allow_html=True)

        st.markdown(f"""
        <div class="metric-box">
            <div class="metric-lbl">Base (Manufacturer)</div>
            <div class="metric-val">{base_fuel} L/100km</div>
        </div>
        <div class="metric-box">
            <div class="metric-lbl">Predicted (Actual)</div>
            <div class="metric-val">{predicted} L/100km</div>
        </div>
        <div class="metric-box">
            <div class="metric-lbl">Over Base</div>
            <div class="metric-val" style="color: {'#f85149' if diff_pct > 20 else '#d29922' if diff_pct > 5 else '#3fb950'}">
                +{diff_pct:.1f}%
            </div>
        </div>
        """, unsafe_allow_html=True)

    else:
        st.markdown("""
        <div class="result-card" style="padding: 60px 28px;">
            <div style="font-size: 3rem; margin-bottom: 16px;">⛽</div>
            <div style="color: #8b949e; font-family: 'Space Mono', monospace; font-size: 0.85rem;">
                Set your trip parameters<br>and hit PREDICT
            </div>
        </div>
        """, unsafe_allow_html=True)