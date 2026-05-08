import streamlit as st
import requests
import json

st.set_page_config(page_title="Driver Behavior AI", layout="wide")

# ── CSS ───────────────────────────────────────────────────────────────────
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Space+Mono:wght@400;700&display=swap');
    html, body, [class*="css"] { font-family: 'DM Sans', sans-serif; }
    .stApp { background-color: #0d1117; color: #e6edf3; }
    section[data-testid="stSidebar"] { background-color: #161b22; border-right: 1px solid #30363d; }

    .result-card {
        border-radius: 16px; padding: 2rem; text-align: center;
        margin-bottom: 1.5rem;
    }
    .score-number {
        font-family: 'Space Mono', monospace; font-size: 72px;
        font-weight: 700; line-height: 1;
    }
    .score-label {
        font-family: 'Space Mono', monospace; font-size: 11px;
        letter-spacing: 3px; text-transform: uppercase;
        color: #8b949e; margin-bottom: 8px;
    }
    .status-badge {
        font-family: 'Space Mono', monospace; font-size: 13px;
        font-weight: 700; letter-spacing: 1px;
        padding: 6px 18px; border-radius: 6px;
        display: inline-block; margin-top: 12px;
    }
    .tip-card {
        background: #161b22; border-radius: 10px;
        padding: 14px 18px; margin-top: 1rem;
        border-left: 4px solid;
    }
    .section-title {
        font-family: 'Space Mono', monospace; font-size: 11px;
        letter-spacing: 3px; text-transform: uppercase;
        color: #8b949e; margin: 1.5rem 0 1rem;
        padding-bottom: 8px; border-bottom: 1px solid #21262d;
    }
    .stat-card {
        background: #161b22; border: 1px solid #30363d;
        border-radius: 10px; padding: 1rem; text-align: center;
    }
    .stat-val {
        font-family: 'Space Mono', monospace;
        font-size: 22px; font-weight: 700;
    }
    .stat-lbl { font-size: 11px; color: #8b949e; margin-top: 4px; }
    .stButton > button {
        background: #238636; color: white; border: none;
        border-radius: 8px; font-weight: 600; font-size: 15px;
        width: 100%; transition: background 0.2s;
    }
    .stButton > button:hover { background: #2ea043; }
    .format-box {
        background: #161b22; border: 1px solid #30363d;
        border-radius: 8px; padding: 14px 18px;
        margin-bottom: 1rem; font-size: 12px; color: #8b949e;
    }
</style>
""", unsafe_allow_html=True)


# ── Helpers ───────────────────────────────────────────────────────────────
def score_color(score):
    if score >= 75: return '#3fb950'
    if score >= 50: return '#d29922'
    return '#f85149'


# ══════════════════════════════════════════════════════════════════════════
# SIDEBAR
# ══════════════════════════════════════════════════════════════════════════
with st.sidebar:
    st.markdown('<div style="font-family:Space Mono,monospace;font-size:20px;font-weight:700">🚗 Driver AI</div>', unsafe_allow_html=True)
    st.markdown('<div style="color:#8b949e;font-size:13px;margin-bottom:1rem">Driver Behavior Analyzer</div>', unsafe_allow_html=True)
    st.markdown("---")

    st.markdown('<div class="section-title">Instructions</div>', unsafe_allow_html=True)
    st.markdown("""
    <div style="font-size:13px;color:#8b949e;line-height:1.8">
        1. الصق الـ JSON في الـ textarea<br>
        2. اضغط <b style="color:#e6edf3">Analyze Driver</b><br>
        3. شوف النتيجة
    </div>
    """, unsafe_allow_html=True)

    st.markdown("---")
    predict_btn = st.button("⚡  Analyze Driver")


# ══════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════
st.markdown('<div style="font-family:Space Mono,monospace;font-size:26px;font-weight:700">Driver Behavior Monitor</div>', unsafe_allow_html=True)
st.markdown('<div style="color:#8b949e;font-size:14px;margin-bottom:1.5rem">Analyze driving behavior from accelerometer & gyroscope sensor data</div>', unsafe_allow_html=True)

# ── Format Guide ──────────────────────────────────────────────────────────
st.markdown('<div class="section-title">Paste Sensor JSON</div>', unsafe_allow_html=True)
st.markdown("""
<div class="format-box">
    <b style="color:#e6edf3">Format المطلوب:</b><br><br>
    <code style="color:#58a6ff">{"acc": [{"x": 0.5, "y": 9.8, "z": 0.1}, ...], "gyro": [{"x": 0.01, "y": 0.02, "z": 0.0}, ...]}</code>
    <br><br>
    كل list لازم تحتوي على نفس عدد القراءات (مثلاً 100 قراءة لكل واحدة)
</div>
""", unsafe_allow_html=True)

raw_json = st.text_area(
    "Sensor Data JSON",
    height=250,
    placeholder='{"acc": [{"x": 0.5, "y": 9.8, "z": 0.1}, ...], "gyro": [{"x": 0.01, "y": 0.02, "z": 0.0}, ...]}',
    label_visibility="collapsed"
)

# ══════════════════════════════════════════════════════════════════════════
# PREDICT
# ══════════════════════════════════════════════════════════════════════════
if predict_btn:
    if not raw_json or not raw_json.strip():
        st.error("❌ الصق الـ JSON الأول قبل ما تضغط Analyze")
        st.stop()

    # ── Parse JSON ────────────────────────────────────────────────────────
    try:
        payload = json.loads(raw_json)
        if 'accelerometer_data' in payload:
            payload['acc'] = payload.pop('accelerometer_data')
        if 'gyroscope_data' in payload:
            payload['gyro'] = payload.pop('gyroscope_data')

        if 'acc' not in payload or 'gyro' not in payload:
            st.error("❌ الـ JSON لازم يحتوي على مفتاحين: `acc` و `gyro`")
            st.stop()

        n_used = len(payload['acc'])

    except Exception as e:
        st.error(f"❌ JSON غلط: {e}")
        st.stop()

    # ── Call API ──────────────────────────────────────────────────────────
    with st.spinner("Analyzing driving behavior..."):
        try:
            resp = requests.post("http://127.0.0.1:5000/predict", json=payload, timeout=10)
            resp.raise_for_status()
            result = resp.json()
        except requests.exceptions.ConnectionError:
            st.error("❌ API مش شغال — تأكد إن app.py شغال على port 5000")
            st.stop()
        except Exception as e:
            st.error(f"❌ Error: {e}")
            st.stop()

    score            = float(result.get('score', 0))
    status           = result.get('status', 'Unknown')
    driver_style_out = result.get('driver_style', 'Normal')
    confidence       = float(result.get('confidence', 75))
    color            = score_color(score)

    # ── Tips ──────────────────────────────────────────────────────────────
    tips_map = {
        'Safe':       ('🟢', '#3fb950', 'Excellent driving behavior. Keep up the smooth and safe driving style.'),
        'Normal':     ('🟡', '#d29922', 'Good driving overall. Try to minimize sudden accelerations and hard braking.'),
        'Aggressive': ('🔴', '#f85149', 'Aggressive patterns detected. Reduce speed changes and avoid harsh braking for safety.'),
    }
    tip_icon, tip_color, tip_text = tips_map.get(driver_style_out, tips_map['Normal'])

    # ── Result Card ───────────────────────────────────────────────────────
    st.markdown(f"""
    <div class="result-card" style="background:#161b22;border:1px solid #30363d;">
        <div class="score-label">Driver Score</div>
        <div class="score-number" style="color:{color}">{score:.0f}</div>
        <div style="color:#8b949e;font-size:13px;margin-top:4px">/100</div>
        <div class="status-badge" style="background:{color}22;color:{color};border:1px solid {color}55">
            {tip_icon} {driver_style_out.upper()}
        </div>
    </div>
    """, unsafe_allow_html=True)

    # ── Stats Row ─────────────────────────────────────────────────────────
    st.markdown('<div class="section-title">Trip Stats</div>', unsafe_allow_html=True)
    c1, c2, c3, c4 = st.columns(4)
    for col, val, lbl in [
        (c1, f"{score:.1f}",      "Driver Score"),
        (c2, f"{confidence:.0f}%","Confidence"),
        (c3, str(n_used),         "Readings"),
        (c4, f"{n_used}s",        "Duration"),
    ]:
        with col:
            st.markdown(f"""
            <div class="stat-card">
                <div class="stat-val" style="color:{color}">{val}</div>
                <div class="stat-lbl">{lbl}</div>
            </div>
            """, unsafe_allow_html=True)

    # ── Tip ───────────────────────────────────────────────────────────────
    st.markdown(f"""
    <div class="tip-card" style="border-color:{tip_color}">
        <div style="font-weight:600;color:{tip_color};margin-bottom:4px">{tip_icon} Recommendation</div>
        <div style="font-size:14px;color:#8b949e">{tip_text}</div>
    </div>
    """, unsafe_allow_html=True)

    # ── Confidence Bar ────────────────────────────────────────────────────
    st.markdown('<div class="section-title">Confidence Level</div>', unsafe_allow_html=True)
    st.progress(confidence / 100)

    # ── Raw JSON ──────────────────────────────────────────────────────────
    with st.expander("📄 Raw API Response"):
        st.json(result)

    with st.expander(f"📊 Sensor Data Sample (first 5 of {n_used} readings)"):
        col1, col2 = st.columns(2)
        with col1:
            st.markdown("**Accelerometer**")
            st.json(payload['acc'][:5])
        with col2:
            st.markdown("**Gyroscope**")
            st.json(payload['gyro'][:5])