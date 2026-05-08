import os
import pandas as pd
import numpy as np

np.random.seed(42)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

df = pd.read_csv(os.path.join(BASE_DIR, 'data', 'raw', 'vehicle_health_dataset.csv'))


def calculate_actual_fuel(row):
    base = row['fuel_combined_l_100km']

    # Speed Effect — تربيعي من 60
    speed_over = max(0, row['avg_speed'] - 60)
    speed_effect = (speed_over ** 2) * 0.002  # قللنا من 0.003

    # Max Speed Effect
    max_speed_effect = max(0, row['max_speed'] - 100) * 0.03  # قللنا من 0.04

    # Overspeed Effect — قللنا تأثيره
    overspeed_effect = row['overspeed_ratio'] * 0.6  # كان 1.2

    # Speed Variance — قللنا تأثيره جداً
    variance_effect = row['speed_variance'] * 0.02  # كان 0.05

    # Style Effect — نفس القيم
    style_map = {0: 0.8, 1: 0.3, 2: 0.0}
    style_effect = style_map[row['driver_style']]

    # Harsh Events
    accel_effect = row['harsh_accel_count'] * 0.15
    brake_effect = row['harsh_brake_count'] * 0.08

    # Weight Effect
    weight_effect = max(0, (row['weight_kg'] - 1000) / 100) * 0.06

    # Noise
    noise = np.random.normal(0, 0.15)

    actual = (base + speed_effect + max_speed_effect + overspeed_effect +
              variance_effect + style_effect + accel_effect +
              brake_effect + weight_effect + noise)

    actual = np.clip(actual, base * 0.95, base * 2.2)

    return round(actual, 2)


df['actual_fuel_l_100km'] = df.apply(calculate_actual_fuel, axis=1)

features = [
    'avg_speed', 'max_speed', 'overspeed_ratio', 'speed_variance',
    'trip_duration_min', 'distance_km', 'harsh_brake_count',
    'harsh_accel_count', 'driver_score', 'driver_style',
    'engine_cc', 'weight_kg', 'fuel_combined_l_100km'
]

fuel_df = df[features + ['actual_fuel_l_100km']].copy()

output_path = os.path.join(BASE_DIR, 'data', 'processed', 'fuel_efficiency_dataset.csv')
os.makedirs(os.path.dirname(output_path), exist_ok=True)
fuel_df.to_csv(output_path, index=False)

print("✅ Dataset v3 generated!")
print()
print("🔍 actual_fuel_l_100km stats:")
print(fuel_df['actual_fuel_l_100km'].describe().round(2))

# تحقق من المنطق
print()
print("📋 Sanity Check بالـ driver_style:")
for style, name in [(2, 'Safe'), (1, 'Normal'), (0, 'Aggressive')]:
    subset = fuel_df[fuel_df['driver_style'] == style]
    mean_actual = subset['actual_fuel_l_100km'].mean()
    mean_base = subset['fuel_combined_l_100km'].mean()
    diff = ((mean_actual - mean_base) / mean_base) * 100
    print(f"  {name:10} → actual={mean_actual:.2f}, base={mean_base:.2f}, +{diff:.1f}%")