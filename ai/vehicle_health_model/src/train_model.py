"""
train_model.py
--------------
Input  : data/processed/vehicle_health_dataset.csv
Output : models/vehicle_health_model.pkl
         models/scaler.pkl  (مش محتاجه في Linear Regression — موجود كـ placeholder)

الموديل: MultiOutput Linear Regression
Targets: engine_health, brake_health, tire_health
"""

import pandas as pd
import numpy as np
import joblib
import os
from sklearn.linear_model import LinearRegression
from sklearn.multioutput import MultiOutputRegressor
from sklearn.model_selection import KFold, train_test_split
from sklearn.metrics import r2_score, mean_absolute_error
import warnings
warnings.filterwarnings('ignore')


# ══════════════════════════════════════════════════════════════════════════
# Config
# ══════════════════════════════════════════════════════════════════════════

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
    # Driver Model output
    'driver_score',
    'driver_style',
    # Vehicle specs (manual)
    'engine_cc',
    'engine_power_hp',
    'weight_kg',
    'fuel_combined_l_100km',
    'year',
]

TARGET_COLUMNS = [
    'engine_health',
    'brake_health',
    'tire_health',
]


# ══════════════════════════════════════════════════════════════════════════
# Load Data
# ══════════════════════════════════════════════════════════════════════════

def load_data(path: str):
    df = pd.read_csv(path)
    print(f"✅ Loaded dataset: {df.shape[0]} rows × {df.shape[1]} cols")

    missing = [c for c in FEATURE_COLUMNS + TARGET_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"Missing columns: {missing}")

    X = df[FEATURE_COLUMNS]
    y = df[TARGET_COLUMNS]
    return X, y


# ══════════════════════════════════════════════════════════════════════════
# Evaluate with Cross Validation
# ══════════════════════════════════════════════════════════════════════════

def cross_validate(model, X, y, n_splits=5):
    kf = KFold(n_splits=n_splits, shuffle=True, random_state=42)
    r2s, maes = [], []

    for fold, (tr, te) in enumerate(kf.split(X), 1):
        model.fit(X.iloc[tr], y.iloc[tr])
        preds = model.predict(X.iloc[te])
        r2s.append(r2_score(y.iloc[te], preds))
        maes.append(mean_absolute_error(y.iloc[te], preds))

    print(f"\n📊 Cross Validation ({n_splits}-Fold):")
    print(f"   R2  = {np.mean(r2s):.4f}  ± {np.std(r2s):.4f}")
    print(f"   MAE = {np.mean(maes):.2f} ± {np.std(maes):.2f}")
    return np.mean(r2s), np.mean(maes)


# ══════════════════════════════════════════════════════════════════════════
# Per-Target Metrics
# ══════════════════════════════════════════════════════════════════════════

def evaluate_per_target(model, X_test, y_test):
    preds = model.predict(X_test)
    print("\n📋 Per-Target Metrics (Test Set):")
    print(f"  {'Target':<18} {'R2':>8} {'MAE':>8}")
    print("  " + "-" * 36)
    for i, col in enumerate(TARGET_COLUMNS):
        r2  = r2_score(y_test.iloc[:, i], preds[:, i])
        mae = mean_absolute_error(y_test.iloc[:, i], preds[:, i])
        print(f"  {col:<18} {r2:>8.4f} {mae:>8.2f}")


# ══════════════════════════════════════════════════════════════════════════
# Main
# ══════════════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    BASE_DIR    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    DATA_PATH   = os.path.join(BASE_DIR, 'data', 'processed', 'vehicle_health_dataset.csv')
    MODEL_DIR   = os.path.join(BASE_DIR, 'models')
    MODEL_PATH  = os.path.join(MODEL_DIR, 'vehicle_health_model.pkl')

    os.makedirs(MODEL_DIR, exist_ok=True)

    # ── Load ──────────────────────────────────────────────────────────────
    X, y = load_data(DATA_PATH)

    # ── Train / Test Split ────────────────────────────────────────────────
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    print(f"   Train: {len(X_train)} rows | Test: {len(X_test)} rows")

    # ── Model ─────────────────────────────────────────────────────────────
    model = MultiOutputRegressor(LinearRegression())

    # ── Cross Validation ──────────────────────────────────────────────────
    cross_validate(model, X_train, y_train)

    # ── Final Train on full train set ─────────────────────────────────────
    model.fit(X_train, y_train)

    # ── Per-target evaluation ─────────────────────────────────────────────
    evaluate_per_target(model, X_test, y_test)

    # ── Save ──────────────────────────────────────────────────────────────
    joblib.dump(model, MODEL_PATH)
    print(f"\n✅ Model saved → {MODEL_PATH}")

    # ── Quick Sanity Check ────────────────────────────────────────────────
    print("\n🔍 Sanity Check (1 sample prediction):")
    sample = X_test.iloc[[0]]
    pred   = model.predict(sample)[0]
    actual = y_test.iloc[0]
    print(f"   Predicted → engine: {pred[0]:.1f} | brake: {pred[1]:.1f} | tire: {pred[2]:.1f}")
    print(f"   Actual    → engine: {actual['engine_health']:.1f} | brake: {actual['brake_health']:.1f} | tire: {actual['tire_health']:.1f}")