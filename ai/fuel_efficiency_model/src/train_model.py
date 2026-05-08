import os
import pandas as pd
import numpy as np
import joblib
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score, mean_absolute_error

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

df = pd.read_csv(os.path.join(BASE_DIR, 'data', 'processed', 'fuel_efficiency_dataset.csv'))

features = [
    'avg_speed', 'max_speed', 'overspeed_ratio', 'speed_variance',
    'trip_duration_min', 'distance_km', 'harsh_brake_count',
    'harsh_accel_count', 'driver_score', 'driver_style',
    'engine_cc', 'weight_kg', 'fuel_combined_l_100km'
]

X = df[features]
y = df['actual_fuel_l_100km']

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# جرب الاتنين وشوف مين أحسن
models = {
    'Linear Regression': LinearRegression(),
    'Gradient Boosting': GradientBoostingRegressor(n_estimators=100, random_state=42)
}

best_model = None
best_r2 = 0
best_name = ''

print("=" * 50)
for name, model in models.items():
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    r2  = r2_score(y_test, y_pred)
    mae = mean_absolute_error(y_test, y_pred)
    print(f"📊 {name}")
    print(f"   R2 Score : {r2:.4f}")
    print(f"   MAE      : {mae:.4f} L/100km")
    print()
    if r2 > best_r2:
        best_r2 = r2
        best_model = model
        best_name = name

print("=" * 50)
print(f"✅ Best Model: {best_name} (R2 = {best_r2:.4f})")

# احفظ أحسن موديل
model_path = os.path.join(BASE_DIR, 'models', 'fuel_efficiency_model.pkl')
os.makedirs(os.path.dirname(model_path), exist_ok=True)
joblib.dump(best_model, model_path)
print("💾 Model saved!")

# شوف أهم الـ Features
if best_name == 'Linear Regression':
    coef_df = pd.DataFrame({
        'feature': features,
        'coefficient': best_model.coef_
    }).sort_values('coefficient', ascending=False)
    print()
    print("🔍 Feature Importance (Coefficients):")
    print(coef_df.to_string(index=False))