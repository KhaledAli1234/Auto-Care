import pandas as pd
import numpy as np
import os


def load_raw_trip(trip_folder):
    """
    تحميل الملفات الخام لرحلة واحدة ودمجها بناءً على أقرب توقيت زمني
    """
    # مسارات الملفات
    acc_path = os.path.join(trip_folder, "acelerometro_terra.csv")
    gyro_path = os.path.join(trip_folder, "giroscopio_terra.csv")
    gt_path = os.path.join(trip_folder, "groundTruth.csv")

    # 1. قراءة الداتا مع مسح المسافات الزائدة من أسماء الأعمدة
    df_acc = pd.read_csv(acc_path)
    df_gyro = pd.read_csv(gyro_path)

    # هنا بنستخدم skipinitialspace=True عشان يحل مشكلة المسافات اللي في الملف بتاعك
    df_gt = pd.read_csv(gt_path, skipinitialspace=True)

    # 2. تحويل الـ uptimeNanos لثواني
    start_time = df_acc['uptimeNanos'].min()
    df_acc['seconds'] = (df_acc['uptimeNanos'] - start_time) / 1e9
    df_gyro['seconds'] = (df_gyro['uptimeNanos'] - start_time) / 1e9

    # 3. دمج الـ Accelerometer والـ Gyroscope
    df_merged = pd.merge_asof(
        df_acc.sort_values('seconds'),
        df_gyro.sort_values('seconds')[['seconds', 'x', 'y', 'z']],
        on='seconds',
        suffixes=('_acc', '_gyro')
    )

    # 4. إضافة الـ Labels (الـ Target)
    df_merged['target'] = 0

    # التأكد من أسماء الأعمدة بعد التنظيف
    for _, row in df_gt.iterrows():
        # إذا كان الحدث فيه كلمة "agressiva" نعتبره 1
        label = 1 if "agressiva" in str(row['evento']) else 0

        # تحديد الفترة الزمنية للحدث
        # دلوقتي 'inicio' و 'fim' هيتقروا صح بدون Key Error
        mask = (df_merged['seconds'] >= row['inicio']) & (df_merged['seconds'] <= row['fim'])
        df_merged.loc[mask, 'target'] = label

    return df_merged


def prepare_all_data(raw_base_path, output_path):
    """
    المرور على كل فولدرات الرحلات وتجميعها
    """
    if not os.path.exists(raw_base_path):
        print(f"❌ Error: Folder {raw_base_path} not found!")
        return

    all_trips = []
    for folder in os.listdir(raw_base_path):
        folder_path = os.path.join(raw_base_path, folder)
        if os.path.isdir(folder_path):
            try:
                print(f"📦 Processing {folder}...")
                trip_df = load_raw_trip(folder_path)
                all_trips.append(trip_df)
            except Exception as e:
                print(f"⚠️ Error in {folder}: {e}")

    if all_trips:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        final_df = pd.concat(all_trips, ignore_index=True)
        final_df.to_csv(output_path, index=False)
        print(f"✅ Success! Data saved to: {output_path}")
        return final_df