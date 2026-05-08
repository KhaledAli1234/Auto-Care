import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score, r2_score
import joblib
import os


def train_model(features_path, model_output_path):
    # 1. تحميل البيانات
    if not os.path.exists(features_path):
        print(f"❌ Error: File {features_path} not found!")
        return

    df = pd.read_csv(features_path)

    # 2. تحديد المدخلات والمخرج
    X = df.drop(columns=['target'])
    y = df['target']

    # 3. تقسيم الداتا
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    print(f"📊 Training on {len(X_train)} samples, Testing on {len(X_test)} samples...")

    # 4. بناء وتدريب الموديل
    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)

    # 5. التقييم الشامل (الجزء المضاف)
    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)

    print("\n" + "=" * 40)
    print("🚀 MODEL PERFORMANCE RESULTS")
    print("=" * 40)
    print(f"🎯 Overall Accuracy: {acc * 100:.2f}%")
    print(f"📉 R2 Score (Regression Metric): {r2:.4f}")
    print("-" * 40)
    print("\n📝 Detailed Classification Report:")
    print(classification_report(y_test, y_pred))
    print("=" * 40)

    # 6. تحليل أهم الميزات (عشان تعرف الموديل بيفكر إزاي)
    print("\n🔍 Top Features Influencing the Score:")
    importances = pd.Series(model.feature_importances_, index=X.columns)
    print(importances.sort_values(ascending=False).head(5))

    # 7. حفظ الموديل
    os.makedirs(os.path.dirname(model_output_path), exist_ok=True)
    joblib.dump(model, model_output_path)
    print(f"\n💾 Model saved successfully at: {model_output_path}")


if __name__ == "__main__":
    # تأكد من المسار الصحيح حسب الـ Structure بتاعك
    train_model("data/processed/final_features.csv", "models/driver_model_v2.pkl")