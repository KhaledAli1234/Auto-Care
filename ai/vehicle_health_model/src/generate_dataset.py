"""
generate_dataset.py
-------------------
Input  : data/raw/all_car_data.csv
Output : data/processed/vehicle_health_dataset.csv

كل عربية → 4 رحلات simulated بـ driver styles مختلفة
الـ health scores محسوبة بمنطق هندسي مبني على:
  - عمر العربية
  - مواصفات المحرك والوزن
  - بيانات الرحلة (speed, braking, إلخ)

ملاحظة على الـ Features:
  بيانات الرحلة (avg_speed, harsh_brake_count, إلخ) بتيجي من
  GPS + Accelerometer sensor في التليفون.
  مواصفات العربية (engine_cc, weight_kg, إلخ) بتتدخل يدوي مرة واحدة.
"""

import pandas as pd
import numpy as np
import os

np.random.seed(42)

CURRENT_YEAR   = 2025
TRIPS_PER_CAR  = 4
STYLE_MAP      = {'Safe': 2, 'Normal': 1, 'Aggressive': 0}
STYLE_PROBS    = [0.30, 0.45, 0.25]   # Safe / Normal / Aggressive


# ══════════════════════════════════════════════════════════════════════════
# Trip Generator
# بيانات الرحلة كلها جايه من sensor التليفون (GPS + Accelerometer)
# ══════════════════════════════════════════════════════════════════════════

def generate_trip(vehicle: dict) -> dict:
    style = np.random.choice(list(STYLE_MAP.keys()), p=STYLE_PROBS)

    # ── Speed (GPS sensor) ────────────────────────────────────────────────
    speed_base        = {'Safe': 55, 'Normal': 70, 'Aggressive': 90}[style]
    style_mult        = {'Safe': 1.0, 'Normal': 1.5, 'Aggressive': 2.5}[style]
    style_event_mult  = {'Safe': 0.3, 'Normal': 0.7, 'Aggressive': 1.5}[style]

    avg_speed         = round(np.clip(np.random.normal(speed_base, 10), 20, 140), 1)
    max_speed         = round(np.clip(avg_speed + np.random.uniform(20, 50), avg_speed, 180), 1)
    speed_variance    = round(np.random.uniform(5, 25) * style_mult, 2)
    overspeed_ratio   = round(np.clip(np.random.uniform(0, 0.4) * style_event_mult, 0, 1), 3)

    # ── Trip duration & distance (GPS sensor) ─────────────────────────────
    trip_duration_min = round(np.random.uniform(15, 120), 1)
    distance_km       = round((avg_speed / 60) * trip_duration_min * np.random.uniform(0.85, 1.1), 2)

    # ── Harsh events (Accelerometer sensor) ───────────────────────────────
    harsh_brake_count = int(np.random.poisson({'Safe': 1, 'Normal': 3, 'Aggressive': 8}[style]))
    harsh_accel_count = int(np.random.poisson({'Safe': 1, 'Normal': 3, 'Aggressive': 7}[style]))

    # ── Driver score (محسوب من Model 1 — Driver Scoring Model) ───────────
    score_base   = {'Safe': 85, 'Normal': 70, 'Aggressive': 45}[style]
    driver_score = round(np.clip(np.random.normal(score_base, 8), 0, 100), 1)

    return {
        'avg_speed':          avg_speed,
        'max_speed':          max_speed,
        'harsh_brake_count':  harsh_brake_count,
        'harsh_accel_count':  harsh_accel_count,
        'overspeed_ratio':    overspeed_ratio,
        'speed_variance':     speed_variance,
        'trip_duration_min':  trip_duration_min,
        'distance_km':        distance_km,
        'driver_score':       driver_score,
        'driver_style':       STYLE_MAP[style],
        '_style_label':       style,   # مش feature — للـ debug بس
    }


# ══════════════════════════════════════════════════════════════════════════
# Health Score Formulas
# ══════════════════════════════════════════════════════════════════════════

def calc_engine_health(v: dict, t: dict) -> float:
    """
    يتأثر بـ:
    - عمر العربية (عامل رئيسي)
    - stress ratio: قوة المحرك نسبة لحجمه
    - harsh acceleration (Accelerometer)
    - overspeed (GPS)
    """
    age        = CURRENT_YEAR - v['year']
    age_factor = np.clip(100 - age * 2.5, 10, 100)
    stress     = v['engine_power_hp'] / (v['engine_cc'] / 100)
    stress_pen = np.clip((stress - 7) * 2, 0, 20)
    accel_pen  = min(t['harsh_accel_count'] * 1.5, 15)
    over_pen   = t['overspeed_ratio'] * 20
    score      = age_factor - stress_pen - accel_pen - over_pen + np.random.normal(0, 3)
    return round(np.clip(score, 0, 100), 1)


def calc_brake_health(v: dict, t: dict) -> float:
    """
    يتأثر بـ:
    - عمر العربية
    - وزن العربية (عربية تقيلة = ضغط أكبر على البريكس)
    - harsh braking (Accelerometer)
    - السرعة القصوى (GPS)
    """
    age        = CURRENT_YEAR - v['year']
    age_factor = np.clip(100 - age * 2.0, 10, 100)
    weight_pen = np.clip((v['weight_kg'] - 1000) / 100, 0, 15)
    brake_pen  = min(t['harsh_brake_count'] * 2.0, 25)
    speed_pen  = np.clip((t['max_speed'] - 100) * 0.15, 0, 15)
    score      = age_factor - weight_pen - brake_pen - speed_pen + np.random.normal(0, 3)
    return round(np.clip(score, 0, 100), 1)


def calc_tire_health(v: dict, t: dict) -> float:
    """
    يتأثر بـ:
    - عمر العربية
    - المسافة (GPS)
    - وزن العربية
    - overspeed + speed variance (GPS)
    - harsh braking & acceleration (Accelerometer)
    """
    age        = CURRENT_YEAR - v['year']
    age_factor = np.clip(100 - age * 1.8, 10, 100)
    dist_pen   = np.clip(t['distance_km'] * 0.05, 0, 15)
    weight_pen = np.clip((v['weight_kg'] - 1000) / 150, 0, 10)
    over_pen   = t['overspeed_ratio'] * 15
    var_pen    = np.clip(t['speed_variance'] * 0.3, 0, 10)
    abuse_pen  = min((t['harsh_brake_count'] + t['harsh_accel_count']) * 0.8, 15)
    score      = age_factor - dist_pen - weight_pen - over_pen - var_pen - abuse_pen + np.random.normal(0, 3)
    return round(np.clip(score, 0, 100), 1)


# ══════════════════════════════════════════════════════════════════════════
# Build Dataset
# ══════════════════════════════════════════════════════════════════════════

def build_dataset(vehicles_df: pd.DataFrame, trips_per_vehicle: int = TRIPS_PER_CAR) -> pd.DataFrame:
    rows = []

    for _, veh in vehicles_df.iterrows():
        v = veh.to_dict()

        for _ in range(trips_per_vehicle):
            trip = generate_trip(v)

            engine_h = calc_engine_health(v, trip)
            brake_h  = calc_brake_health(v, trip)
            tire_h   = calc_tire_health(v, trip)

            rows.append({
                # ── Vehicle specs (manual input / static) ────────────────
                'vehicle_id':            v['ID'],
                'year':                  v['year'],
                'engine_cc':             v['engine_cc'],
                'engine_power_hp':       v['engine_power_hp'],
                'weight_kg':             v['weight_kg'],
                'fuel_combined_l_100km': v['fuel_combined_l_100km'],

                # ── Trip data (GPS sensor) ────────────────────────────────
                'avg_speed':             trip['avg_speed'],
                'max_speed':             trip['max_speed'],
                'overspeed_ratio':       trip['overspeed_ratio'],
                'speed_variance':        trip['speed_variance'],
                'trip_duration_min':     trip['trip_duration_min'],
                'distance_km':           trip['distance_km'],

                # ── Harsh events (Accelerometer sensor) ──────────────────
                'harsh_brake_count':     trip['harsh_brake_count'],
                'harsh_accel_count':     trip['harsh_accel_count'],

                # ── Driver info (from Model 1) ────────────────────────────
                'driver_score':          trip['driver_score'],
                'driver_style':          trip['driver_style'],

                # ── Labels (targets) ──────────────────────────────────────
                'engine_health':         engine_h,
                'brake_health':          brake_h,
                'tire_health':           tire_h,
                'vehicle_health_score':  round((engine_h + brake_h + tire_h) / 3, 1),
            })

    return pd.DataFrame(rows)


# ══════════════════════════════════════════════════════════════════════════
# Main
# ══════════════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    BASE_DIR    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    INPUT_PATH  = os.path.join(BASE_DIR, 'data', 'raw', 'all_car_data.csv')
    OUTPUT_PATH = os.path.join(BASE_DIR, 'data', 'processed', 'vehicle_health_dataset.csv')

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

    print(f"📂 Loading vehicles from: {INPUT_PATH}")
    vehicles_df = pd.read_csv(INPUT_PATH)
    print(f"✅ Loaded {len(vehicles_df)} vehicles")

    print(f"⚙️  Generating {TRIPS_PER_CAR} trips per vehicle...")
    dataset = build_dataset(vehicles_df, TRIPS_PER_CAR)

    dataset.to_csv(OUTPUT_PATH, index=False)
    print(f"✅ Saved {len(dataset)} rows → {OUTPUT_PATH}")

    print("\n📊 Health Score Stats:")
    print(dataset[['engine_health', 'brake_health', 'tire_health', 'vehicle_health_score']].describe().round(1).to_string())
