import pandas as pd
import numpy as np
import joblib


class DriverPipeline:
    def __init__(self, model_path):
        # تحميل الموديل المدرب
        self.model = joblib.load(model_path)
        print(f"✅ Model loaded from {model_path}")

    def calculate_features(self, acc_data, gyro_data):
        # تحويل القوائم إلى DataFrames مع تحديد الأعمدة
        df_acc = pd.DataFrame(acc_data)
        df_gyro = pd.DataFrame(gyro_data)

        # حساب الـ Magnitude مع التأكد من وجود الأعمدة
        acc_mag = np.sqrt(df_acc['x'] ** 2 + df_acc['y'] ** 2 + df_acc['z'] ** 2)
        gyro_mag = np.sqrt(df_gyro['x'] ** 2 + df_gyro['y'] ** 2 + df_gyro['z'] ** 2)

        features = {
            'acc_mag_mean': acc_mag.mean(),
            'acc_mag_std': acc_mag.std() if len(acc_mag) > 1 else 0.0,
            'acc_mag_max': acc_mag.max(),
            'acc_mag_min': acc_mag.min(),
            'acc_mag_var': acc_mag.var() if len(acc_mag) > 1 else 0.0,
            'gyro_mag_mean': gyro_mag.mean(),
            'gyro_mag_std': gyro_mag.std() if len(gyro_mag) > 1 else 0.0,
            'gyro_mag_max': gyro_mag.max()
        }
        return pd.DataFrame([features])



    def predict_score(self, acc_list, gyro_list):
        features_df = self.calculate_features(acc_list, gyro_list)

        # الحصول على الاحتمالات لكل كلاس [0, 1]
        probabilities = self.model.predict_proba(features_df)[0]

        # احتمالية إنه يكون Aggressive (Class 1)
        # لو الموديل مش متأكد، الاحتمالية هتكون 0
        proba_aggressive = probabilities[1] if len(probabilities) > 1 else 0.0

        score = (1 - proba_aggressive) * 100

        if score > 80:
            status = "Excellent"
        elif score > 60:
            status = "Good"
        elif score > 40:
            status = "Risky"
        else:
            status = "Aggressive"

        return float(score), status