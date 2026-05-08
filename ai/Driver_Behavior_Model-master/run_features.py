from src.features import extract_features

if __name__ == "__main__":
    # هنحول الداتا المدموجة لداتا جاهزة للتدريب
    extract_features(
        "data/processed/merged_data.csv",
        "data/processed/final_features.csv"
    )