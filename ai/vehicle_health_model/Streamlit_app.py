"""
streamlit_app.py
----------------
UI لتجربة Vehicle Health Model
تشغيل: streamlit run streamlit_app.py
"""

import streamlit as st
import joblib
import pandas as pd
import numpy as np
import os

# ── Page Config ───────────────────────────────────────────────────────────
st.set_page_config(
    page_title="Vehicle Health Monitor",
    page_icon="🚗",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Custom CSS ────────────────────────────────────────────────────────────
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');

    html, body, [class*="css"] {
        font-family: 'DM Sans', sans-serif;
    }

    .stApp {
        background-color: #0d1117;
        color: #e6edf3;
    }

    section[data-testid="stSidebar"] {
        background-color: #161b22;
        border-right: 1px solid #30363d;
    }

    .metric-card {
        background: #161b22;
        border: 1px solid #30363d;
        border-radius: 12px;
        padding: 1.5rem;
        text-align: center;
        transition: border-color 0.2s;
    }

    .metric-card:hover { border-color: #58a6ff; }

    .metric-label {
        font-family: 'Space Mono', monospace;
        font-size: 11px;
        letter-spacing: 2px;
        text-transform: uppercase;
        color: #8b949e;
        margin-bottom: 8px;
    }

    .metric-value {
        font-family: 'Space Mono', monospace;
        font-size: 42px;
        font-weight: 700;
        line-height: 1;
        margin-bottom: 6px;
    }

    .metric-status {
        font-size: 12px;
        font-weight: 500;
        padding: 3px 10px;
        border-radius: 20px;
        display: inline-block;
    }

    .status-excellent { background: #0d4429; color: #3fb950; border: 1px solid #26a641; }
    .status-good      { background: #0a3069; color: #58a6ff; border: 1px solid #1f6feb; }
    .status-fair      { background: #341a00; color: #d29922; border: 1px solid #9e6a03; }
    .status-poor      { background: #3d0000; color: #f85149; border: 1px solid #da3633; }

    .overall-card {
        background: linear-gradient(135deg, #161b22 0%, #1c2128 100%);
        border: 1px solid #30363d;
        border-radius: 16px;
        padding: 2rem;
        text-align: center;
        margin-bottom: 1.5rem;
    }

    .overall-score {
        font-family: 'Space Mono', monospace;
        font-size: 72px;
        font-weight: 700;
        line-height: 1;
    }

    .risk-badge {
        font-family: 'Space Mono', monospace;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 1px;
        padding: 6px 18px;
        border-radius: 6px;
        display: inline-block;
        margin-top: 12px;
    }

    .risk-low      { background: #0d4429; color: #3fb950; border: 1px solid #26a641; }
    .risk-medium   { background: #341a00; color: #d29922; border: 1px solid #9e6a03; }
    .risk-high     { background: #3d1a00; color: #f0883e; border: 1px solid #bd561d; }
    .risk-critical { background: #3d0000; color: #f85149; border: 1px solid #da3633; }

    .alert-card {
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 8px;
        display: flex;
        align-items: flex-start;
        gap: 10px;
    }

    .alert-critical { background: #3d000020; border: 1px solid #da3633; }
    .alert-warning  { background: #34170020; border: 1px solid #9e6a03; }
    .alert-advisory { background: #0a306920; border: 1px solid #1f6feb; }
    .alert-info     { background: #0d442920; border: 1px solid #26a641; }

    .alert-icon { font-size: 16px; margin-top: 1px; }
    .alert-title { font-weight: 600; font-size: 13px; }
    .alert-score { font-size: 11px; font-family: 'Space Mono', monospace; opacity: 0.6; margin-left: 6px; }
    .alert-msg { font-size: 12px; color: #8b949e; margin-top: 2px; }

    .progress-bar-bg {
        background: #21262d;
        border-radius: 6px;
        height: 8px;
        overflow: hidden;
        margin-top: 6px;
    }

    .section-title {
        font-family: 'Space Mono', monospace;
        font-size: 11px;
        letter-spacing: 3px;
        text-transform: uppercase;
        color: #8b949e;
        margin: 1.5rem 0 1rem;
        padding-bottom: 8px;
        border-bottom: 1px solid #21262d;
    }

    div[data-testid="stSlider"] label,
    div[data-testid="stNumberInput"] label,
    div[data-testid="stSelectbox"] label {
        font-size: 12px !important;
        color: #8b949e !important;
        font-family: 'Space Mono', monospace !important;
        letter-spacing: 1px !important;
    }

    .stButton > button {
        background: #238636;
        color: white;
        border: none;
        border-radius: 8px;
        padding: 0.6rem 1.5rem;
        font-family: 'DM Sans', sans-serif;
        font-weight: 600;
        font-size: 15px;
        width: 100%;
        transition: background 0.2s;
    }

    .stButton > button:hover { background: #2ea043; }

    .header-title {
        font-family: 'Space Mono', monospace;
        font-size: 28px;
        font-weight: 700;
        color: #e6edf3;
        letter-spacing: -1px;
    }

    .header-sub {
        color: #8b949e;
        font-size: 14px;
        margin-top: 4px;
    }
</style>
""", unsafe_allow_html=True)


# ── Load Model ────────────────────────────────────────────────────────────
@st.cache_resource
def load_model():
    model_path = os.path.join(os.path.dirname(__file__), 'models', 'vehicle_health_model.pkl')
    return joblib.load(model_path)

model = load_model()

FEATURE_COLUMNS = [
    'avg_speed', 'max_speed', 'overspeed_ratio', 'speed_variance',
    'trip_duration_min', 'distance_km', 'harsh_brake_count', 'harsh_accel_count',
    'driver_score', 'driver_style', 'engine_cc', 'engine_power_hp',
    'weight_kg', 'fuel_combined_l_100km', 'year',
]

STYLE_MAP = {'Safe': 2, 'Normal': 1, 'Aggressive': 0}


# ── Helpers ───────────────────────────────────────────────────────────────
def get_status(score):
    if score >= 80: return 'Excellent', 'excellent'
    if score >= 60: return 'Good',      'good'
    if score >= 40: return 'Fair',      'fair'
    return 'Poor', 'poor'

def get_risk(score):
    if score >= 80: return 'LOW RISK',      'low'
    if score >= 60: return 'MEDIUM RISK',   'medium'
    if score >= 40: return 'HIGH RISK',     'high'
    return 'CRITICAL',  'critical'

def score_color(score):
    if score >= 80: return '#3fb950'
    if score >= 60: return '#58a6ff'
    if score >= 40: return '#d29922'
    return '#f85149'

ALERT_CONFIG = {
    'Engine': {
        'critical': 'Engine health is critically low. Immediate inspection is required to avoid engine failure.',
        'warning':  'Engine health is degrading. Schedule a full engine service within the next 2 weeks.',
        'advisory': 'Engine health is declining. Plan a maintenance check within the next month to prevent further wear.',
        'info':     'Minor engine wear detected. Ensure oil levels and filters are up to date at your next service.',
    },
    'Brakes': {
        'critical': 'Brake system health is critically low. Stop driving and have the brakes inspected immediately for safety.',
        'warning':  'Brake health is below acceptable levels. Brake pads or discs may need replacement within the next 2 weeks.',
        'advisory': 'Brake health is gradually declining. Schedule a brake inspection within the next month.',
        'info':     'Slight brake wear detected. Monitor brake performance and plan a routine check at your next service.',
    },
    'Tires': {
        'critical': 'Tires are critically worn. Replace all tires immediately — continuing to drive is unsafe.',
        'warning':  'Tire health is low. One or more tires may need replacement within the next 2 weeks.',
        'advisory': 'Tire wear is above normal. Plan a tire rotation or replacement within the next month.',
        'info':     'Minor tire wear detected. Check tire pressure regularly and monitor tread depth.',
    },
}

def generate_alerts(engine, brake, tire):
    alerts = []
    for name, score in [('Engine', engine), ('Brakes', brake), ('Tires', tire)]:
        cfg = ALERT_CONFIG[name]
        if score < 40:
            severity, message = 'Critical', cfg['critical']
        elif score < 60:
            severity, message = 'Warning',  cfg['warning']
        elif score < 75:
            severity, message = 'Advisory', cfg['advisory']
        elif score < 85:
            severity, message = 'Info',     cfg['info']
        else:
            continue
        alerts.append({'component': name, 'severity': severity, 'health_score': round(score, 1), 'message': message})
    return alerts


# ══════════════════════════════════════════════════════════════════════════
# SIDEBAR — Inputs
# ══════════════════════════════════════════════════════════════════════════

with st.sidebar:
    st.markdown('<div class="header-title">🚗 VHM</div>', unsafe_allow_html=True)
    st.markdown('<div class="header-sub">Vehicle Health Monitor</div>', unsafe_allow_html=True)
    st.markdown("---")

    st.markdown('<div class="section-title">📡 Trip Data — GPS Sensor</div>', unsafe_allow_html=True)
    avg_speed        = st.slider("Avg Speed (km/h)",       20, 140, 70)
    max_speed        = st.slider("Max Speed (km/h)",       avg_speed, 180, min(avg_speed + 30, 180))
    overspeed_ratio  = st.slider("Overspeed Ratio",        0.0, 1.0, 0.1, 0.01)
    speed_variance   = st.slider("Speed Variance",         1.0, 50.0, 12.0, 0.5)
    trip_duration    = st.slider("Trip Duration (min)",    5, 120, 35)
    distance_km      = st.slider("Distance (km)",          1.0, 150.0, 30.0, 0.5)

    st.markdown('<div class="section-title">📳 Harsh Events — Accelerometer</div>', unsafe_allow_html=True)
    harsh_brake      = st.slider("Harsh Brake Count",      0, 20, 2)
    harsh_accel      = st.slider("Harsh Accel Count",      0, 20, 2)

    st.markdown('<div class="section-title">👤 Driver — Model 1 Output</div>', unsafe_allow_html=True)
    driver_score     = st.slider("Driver Score",           0, 100, 75)
    driver_style_raw = st.selectbox("Driver Style",        ['Safe', 'Normal', 'Aggressive'])

    st.markdown('<div class="section-title">🔧 Vehicle Specs</div>', unsafe_allow_html=True)
    engine_cc        = st.number_input("Engine CC",        500, 6000, 1600, 50)
    engine_hp        = st.number_input("Engine HP",        50,  500,  110,  5)
    weight_kg        = st.number_input("Weight (kg)",      600, 3500, 1200, 50)
    fuel_consumption = st.number_input("Fuel (L/100km)",   3.0, 25.0, 8.0,  0.1)
    year             = st.number_input("Year",             1990, 2025, 2018, 1)

    st.markdown("<br>", unsafe_allow_html=True)
    predict_btn = st.button("⚡  Run Prediction")


# ══════════════════════════════════════════════════════════════════════════
# MAIN — Header
# ══════════════════════════════════════════════════════════════════════════

st.markdown('<div class="header-title">Vehicle Health Monitor</div>', unsafe_allow_html=True)
st.markdown('<div class="header-sub">Predict engine, brake & tire health from trip sensor data</div>', unsafe_allow_html=True)
st.markdown("<br>", unsafe_allow_html=True)


# ══════════════════════════════════════════════════════════════════════════
# MAIN — Results
# ══════════════════════════════════════════════════════════════════════════

if predict_btn:
    features = pd.DataFrame([{
        'avg_speed':             float(avg_speed),
        'max_speed':             float(max_speed),
        'overspeed_ratio':       float(overspeed_ratio),
        'speed_variance':        float(speed_variance),
        'trip_duration_min':     float(trip_duration),
        'distance_km':           float(distance_km),
        'harsh_brake_count':     float(harsh_brake),
        'harsh_accel_count':     float(harsh_accel),
        'driver_score':          float(driver_score),
        'driver_style':          float(STYLE_MAP[driver_style_raw]),
        'engine_cc':             float(engine_cc),
        'engine_power_hp':       float(engine_hp),
        'weight_kg':             float(weight_kg),
        'fuel_combined_l_100km': float(fuel_consumption),
        'year':                  int(year),
    }])[FEATURE_COLUMNS]

    preds  = model.predict(features)[0]
    engine = round(float(np.clip(preds[0], 0, 100)), 1)
    brake  = round(float(np.clip(preds[1], 0, 100)), 1)
    tire   = round(float(np.clip(preds[2], 0, 100)), 1)
    overall = round((engine + brake + tire) / 3, 1)

    risk_label, risk_cls   = get_risk(overall)
    ovr_status, ovr_cls    = get_status(overall)
    ovr_color              = score_color(overall)
    alerts                 = generate_alerts(engine, brake, tire)

    # ── Overall Card ──────────────────────────────────────────────────────
    st.markdown(f"""
    <div class="overall-card">
        <div class="metric-label">Overall Vehicle Health</div>
        <div class="overall-score" style="color:{ovr_color}">{overall}</div>
        <div style="color:#8b949e; font-size:13px; margin-top:6px;">/100</div>
        <div class="risk-badge risk-{risk_cls}">{risk_label}</div>
    </div>
    """, unsafe_allow_html=True)

    # ── Component Cards ───────────────────────────────────────────────────
    st.markdown('<div class="section-title">Component Health</div>', unsafe_allow_html=True)
    col1, col2, col3 = st.columns(3)

    for col, name, score, icon in [
        (col1, "Engine",  engine, "🔧"),
        (col2, "Brakes",  brake,  "🛑"),
        (col3, "Tires",   tire,   "🔴"),
    ]:
        status_label, status_cls = get_status(score)
        color = score_color(score)
        pct   = int(score)
        with col:
            st.markdown(f"""
            <div class="metric-card">
                <div class="metric-label">{icon} {name}</div>
                <div class="metric-value" style="color:{color}">{score}</div>
                <div class="metric-status status-{status_cls}">{status_label}</div>
                <div class="progress-bar-bg">
                    <div style="height:8px; width:{pct}%; background:{color}; border-radius:6px; transition:width 0.5s;"></div>
                </div>
            </div>
            """, unsafe_allow_html=True)

    # ── Alerts ────────────────────────────────────────────────────────────
    SEVERITY_META = {
        'Critical': ('🔴', 'critical', '#f85149'),
        'Warning':  ('🟠', 'warning',  '#d29922'),
        'Advisory': ('🔵', 'advisory', '#58a6ff'),
        'Info':     ('🟢', 'info',     '#3fb950'),
    }

    if alerts:
        st.markdown('<div class="section-title">Maintenance Alerts</div>', unsafe_allow_html=True)
        for a in alerts:
            icon, sev_cls, color = SEVERITY_META[a['severity']]
            st.markdown(f"""
            <div class="alert-card alert-{sev_cls}">
                <div class="alert-icon">{icon}</div>
                <div style="flex:1">
                    <div>
                        <span class="alert-title" style="color:{color}">{a['component']}</span>
                        <span style="font-size:11px; font-family:'Space Mono',monospace;
                              background:#21262d; color:#8b949e; padding:2px 7px;
                              border-radius:4px; margin-left:8px;">{a['severity'].upper()}</span>
                        <span style="font-size:11px; font-family:'Space Mono',monospace;
                              color:#8b949e; margin-left:6px;">{a['health_score']}/100</span>
                    </div>
                    <div class="alert-msg">{a['message']}</div>
                </div>
            </div>
            """, unsafe_allow_html=True)
    else:
        st.markdown('<div class="section-title">Maintenance Alerts</div>', unsafe_allow_html=True)
        st.markdown("""
        <div class="alert-card" style="border:1px solid #26a641; background:#0d442920;">
            <div class="alert-icon">✅</div>
            <div>
                <div class="alert-title" style="color:#3fb950;">All systems nominal</div>
                <div class="alert-msg">No maintenance alerts detected. Vehicle is in excellent condition.</div>
            </div>
        </div>
        """, unsafe_allow_html=True)

    # ── Input Summary ─────────────────────────────────────────────────────
    with st.expander("📋 Input Summary"):
        st.dataframe(features.T.rename(columns={0: 'Value'}), use_container_width=True)

else:
    # ── Placeholder ───────────────────────────────────────────────────────
    st.markdown("""
    <div style="text-align:center; padding: 4rem 2rem; color:#8b949e;">
        <div style="font-size:64px; margin-bottom:1rem;">🚗</div>
        <div style="font-family:'Space Mono',monospace; font-size:16px; margin-bottom:8px; color:#e6edf3;">
            Ready to predict
        </div>
        <div style="font-size:14px;">
            Set the trip parameters in the sidebar<br>then click <strong style="color:#3fb950;">Run Prediction</strong>
        </div>
    </div>
    """, unsafe_allow_html=True)