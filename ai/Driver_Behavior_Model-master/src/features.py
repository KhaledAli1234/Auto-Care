import pandas as pd
import numpy as np


def extract_features(input_path, output_path, window_size=100, step_size=50):
    """
    تحويل البيانات الخام إلى ميزات إحصائية باستخدام نافذة منزلقة
    window_size: عدد الأسطر في كل نافذة (مثلاً 100 سطر = ثانية واحدة تقريباً)
    step_size: مقدار القفزة (50 يعني فيه تداخل بنسبة 50% بين كل نافذة والتانية)
    """
    df = pd.read_csv(input_path)

    # 1. حساب محصلة القوى (Magnitude) للتسارع والدوران
    df['acc_mag'] = np.sqrt(df['x_acc'] ** 2 + df['y_acc'] ** 2 + df['z_acc'] ** 2)
    df['gyro_mag'] = np.sqrt(df['x_gyro'] ** 2 + df['y_gyro'] ** 2 + df['z_gyro'] ** 2)

    features_list = []

    # 2. تحريك النافذة على البيانات
    for i in range(0, len(df) - window_size, step_size):
        window = df.iloc[i: i + window_size]

        # استخراج الميزات من النافذة الحالية
        feature_row = {
            'acc_mag_mean': window['acc_mag'].mean(),
            'acc_mag_std': window['acc_mag'].std(),
            'acc_mag_max': window['acc_mag'].max(),
            'acc_mag_min': window['acc_mag'].min(),
            'acc_mag_var': window['acc_mag'].var(),

            'gyro_mag_mean': window['gyro_mag'].mean(),
            'gyro_mag_std': window['gyro_mag'].std(),
            'gyro_mag_max': window['gyro_mag'].max(),

            # الـ Target للنافذة: لو فيه لحظة واحدة عنيفة في الـ 100 سطر، بنعتبر النافذة كلها عنيفة
            'target': 1 if window['target'].max() > 0 else 0
        }
        features_list.append(feature_row)

    # 3. حفظ النتائج
    features_df = pd.DataFrame(features_list)
    features_df.to_csv(output_path, index=False)
    print(f"✨ تم تحويل {len(df)} سطر خام إلى {len(features_df)} سطر ميزات.")
    print(f"✅ تم حفظ ملف الميزات في: {output_path}")
    return features_df