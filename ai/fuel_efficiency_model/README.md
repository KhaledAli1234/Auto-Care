# ⛽ Fuel Efficiency Model — Model 3

> نموذج تعلم آلي يتنبأ باستهلاك الوقود الفعلي (L/100km) بناءً على بيانات الرحلة من سنسورات التليفون + مواصفات العربية + أسلوب القيادة.

---

## 📋 جدول المحتويات

1. [نظرة عامة](#نظرة-عامة)
2. [ليه Gradient Boosting؟](#ليه-gradient-boosting)
3. [الداتا — من فين جاءت وإزاي اتحولت](#الداتا)
4. [المعادلة المستخدمة لحساب الـ Actual Fuel](#المعادلة)
5. [نظام الـ Trend — Improving / Declining](#نظام-الـ-trend)
6. [الـ Features الموجودة في الداتا](#الـ-features)
7. [استراكشر الفولدر](#استراكشر-الفولدر)
8. [شرح كل ملف بالتفصيل](#شرح-الملفات)
9. [إزاي تشغّل المشروع](#تشغيل-المشروع)
10. [نتايج الموديل](#نتايج-الموديل)

---

## نظرة عامة

الموديل ده جزء من منظومة أكبر بتتكون من تلت موديلات:

```
Model 1 (Driver Behavior)   →  driver_score + driver_style
                                        ↓
Model 2 (Vehicle Health)    →  engine_health + brake_health + tire_health
                                        ↓
Model 3 (Fuel Efficiency)   →  actual_fuel_l_100km + trend + efficiency_label
```

**Model 3** بياخد بيانات الرحلة الجاية من سنسورات التليفون + output من Model 1 + مواصفات العربية، ويطلع استهلاك الوقود الفعلي للرحلة ومقارنته بالرحلة اللي قبلها.

---

## ليه Gradient Boosting؟

### مقارنة الموديلات

| الموديل | R2 Score | MAE | السرعة | الحجم |
|---|---|---|---|---|
| **Gradient Boosting** | **0.9877** | **0.19** | ⚡ سريع | متوسط |
| Linear Regression | 0.9770 | 0.22 | ⚡ سريع جداً | صغير جداً |

### سبب الاختيار

اخترنا **Gradient Boosting** لأن:

- **R2 أعلى** (0.9877 vs 0.9770) — دقة أحسن بشكل واضح
- **MAE أقل** (0.19 vs 0.22 L/100km) — خطأ أصغر في التوقع
- **بيلتقط العلاقات غير الخطية** — العلاقة بين السرعة والاستهلاك مش خطية تماماً
- **Feature Importance واضحة** — بنعرف إيه أهم عوامل الاستهلاك

> ملاحظة: الـ R2 العالي (98.8%) مرتبط بطبيعة الداتا الـ simulated. في بيانات حقيقية، الأداء هيبقى مختلف وده طبيعي.

---

## الداتا

### المصدر الأصلي

الداتا الخام هي نفس ملف `vehicle_health_dataset.csv` اللي اتولد في **Model 2**:

```
vehicle_id, year, engine_cc, engine_power_hp, weight_kg,
fuel_combined_l_100km, avg_speed, max_speed, overspeed_ratio,
speed_variance, trip_duration_min, distance_km,
harsh_brake_count, harsh_accel_count, driver_score, driver_style,
engine_health, brake_health, tire_health, vehicle_health_score
```

**الحجم:** 3,416 صف (854 عربية × 4 رحلات).

### المشكلة

الداتا الأصلية مش فيها `actual_fuel_l_100km` — اللي موجود بس هو `fuel_combined_l_100km` وده **ثابت لكل عربية** مش بيتغير من رحلة لرحلة، يعني مفيش Target للموديل يتعلم منه الاستهلاك الفعلي.

### الحل — Simulation Pipeline

```
vehicle_health_dataset.csv (3,416 صف)
              ↓
  generate_dataset.py
              ↓
  حساب actual_fuel بمعادلة هندسية
  بناءً على أسلوب القيادة + السرعة + مواصفات العربية
              ↓
fuel_efficiency_dataset.csv (3,416 صف)
```

### إزاي اتولد الـ actual_fuel

لكل رحلة بيتحسب استهلاك حقيقي بناءً على عوامل متعددة — مش عشوائي:

| العامل | التأثير |
|---|---|
| Aggressive Style | +0.8 L/100km |
| Normal Style | +0.3 L/100km |
| Safe Style | +0.0 L/100km |
| كل 10 km/h فوق 60 | +تربيعي |
| كل harsh acceleration | +0.15 L/100km |
| كل harsh brake | +0.08 L/100km |
| كل 100 kg فوق 1000 | +0.06 L/100km |

---

## المعادلة

```
speed_over      = max(0, avg_speed - 60)
speed_effect    = (speed_over ^ 2) × 0.002

max_speed_effect = max(0, max_speed - 100) × 0.03

overspeed_effect = overspeed_ratio × 0.6

variance_effect  = speed_variance × 0.02

style_map        = {Aggressive: 0.8, Normal: 0.3, Safe: 0.0}
style_effect     = style_map[driver_style]

accel_effect     = harsh_accel_count × 0.15
brake_effect     = harsh_brake_count × 0.08

weight_effect    = max(0, (weight_kg - 1000) / 100) × 0.06

noise            = random.normal(0, 0.15)

actual_fuel = base_fuel + speed_effect + max_speed_effect +
              overspeed_effect + variance_effect + style_effect +
              accel_effect + brake_effect + weight_effect + noise

actual_fuel = clip(actual_fuel, base × 0.95, base × 2.2)
```

**المنطق:**
- السرعة فوق 60 km/h بتزود الاستهلاك بشكل تربيعي — مش خطي
- القيادة العدوانية زيادة ثابتة على كل عوامل السرعة
- الـ noise بيحاكي التباين الطبيعي في الواقع

---

## نظام الـ Trend

### الفكرة

بعد ما الموديل يتوقع الاستهلاك الفعلي للرحلة الحالية، بيقارنه بالرحلة اللي قبلها ويطلع trend واضح للمستخدم.

### منطق الحساب

```python
diff_percent = (previous_fuel - current_fuel) / previous_fuel × 100

if diff_percent > 1%  → Improving  ▲
if diff_percent < -1% → Declining  ▼
else                  → Stable     →
```

### تصنيف الـ Efficiency Label

| النطاق عن الـ Base | الـ Label |
|---|---|
| ≤ 5% | Excellent |
| 6% — 20% | Good |
| 21% — 40% | Fair |
| > 40% | Poor |

### شكل الـ Response في الـ API

```json
{
  "actual_fuel_l_100km" : 8.61,
  "base_fuel_l_100km"   : 7.5,
  "efficiency_label"    : "Good",
  "trend"               : "Improving",
  "trend_message"       : "4.9% better than last trip"
}
```

---

## الـ Features

### Feature Groups

#### 📡 GPS Sensor (من التليفون مباشرة)

| Feature | الوصف | الوحدة |
|---|---|---|
| `avg_speed` | متوسط السرعة طول الرحلة | km/h |
| `max_speed` | أعلى سرعة وصلها في الرحلة | km/h |
| `overspeed_ratio` | نسبة الوقت اللي فيها تجاوز الحد المسموح | 0.0 — 1.0 |
| `speed_variance` | مدى تذبذب السرعة (قيادة غير منتظمة) | — |
| `trip_duration_min` | مدة الرحلة | دقيقة |
| `distance_km` | المسافة المقطوعة | كيلومتر |

#### 📳 Accelerometer Sensor (من التليفون مباشرة)

| Feature | الوصف |
|---|---|
| `harsh_brake_count` | عدد مرات الكبح الحاد |
| `harsh_accel_count` | عدد مرات التسريع الحاد |

#### 👤 Driver Info (Output من Model 1)

| Feature | الوصف | القيم |
|---|---|---|
| `driver_score` | درجة السائق الكلية | 0 — 100 |
| `driver_style` | أسلوب القيادة (encoded) | 0=Aggressive, 1=Normal, 2=Safe |

#### 🔧 Vehicle Specs (إدخال يدوي مرة واحدة)

| Feature | الوصف | الوحدة |
|---|---|---|
| `engine_cc` | حجم المحرك | سي سي |
| `weight_kg` | وزن العربية | كيلوجرام |
| `fuel_combined_l_100km` | استهلاك الوقود المعياري من الشركة | لتر/100كم |

### الـ Target (اللي الموديل بيتنبأ بيه)

| Target | الوصف | النطاق |
|---|---|---|
| `actual_fuel_l_100km` | استهلاك الوقود الفعلي للرحلة | 4.0 — 25.0+ |

---

## استراكشر الفولدر

```
fuel_efficiency_model/
│
├── 📁 data/
│   ├── 📁 raw/
│   │   └── vehicle_health_dataset.csv      ← الداتا الخام (من Model 2)
│   └── 📁 processed/
│       └── fuel_efficiency_dataset.csv     ← الداتا بعد إضافة actual_fuel
│
├── 📁 models/
│   └── fuel_efficiency_model.pkl           ← الموديل المدرب والمحفوظ
│
├── 📁 src/
│   ├── generate_dataset.py                 ← يضيف actual_fuel للداتا
│   └── train_model.py                      ← يدرب الموديل ويحفظه
│
├── app.py                                  ← Flask REST API
├── streamlit_app.py                        ← واجهة المستخدم التفاعلية
├── requirements.txt                        ← المكتبات المطلوبة
└── README.md                               ← هذا الملف
```

---

## شرح الملفات

### 📄 `data/raw/vehicle_health_dataset.csv`

**اللازمة:** الداتا الأصلية اللي المشروع بيبدأ منها.

نفس ملف الـ output من Model 2 — فيه مواصفات 854 عربية × 4 رحلات. بيُستخدم كـ input لـ `generate_dataset.py` عشان يضيف عليه عمود الاستهلاك الفعلي.

---

### 📄 `data/processed/fuel_efficiency_dataset.csv`

**اللازمة:** الداتا الجاهزة للتدريب — المخرج من `generate_dataset.py`.

نفس الـ 3,416 صف بس بالإضافة لعمود `actual_fuel_l_100km` اللي اتحسب بالمعادلة الهندسية. الموديل بيتدرب على هذا الملف مباشرة.

---

### 📄 `src/generate_dataset.py`

**اللازمة:** إضافة عمود الاستهلاك الفعلي للداتا.

**بيعمل إيه:**
1. بيقرأ `vehicle_health_dataset.csv`
2. لكل رحلة بيحسب `actual_fuel_l_100km` بالمعادلة الهندسية
3. بيحفظ النتيجة في `fuel_efficiency_dataset.csv`

**متى تشغّله:** مرة واحدة في البداية قبل التدريب.

```bash
python src/generate_dataset.py
```

---

### 📄 `src/train_model.py`

**اللازمة:** تدريب الموديل وحفظه.

**بيعمل إيه:**
1. بيقرأ `fuel_efficiency_dataset.csv`
2. بيعمل Train/Test Split (80% / 20%)
3. بيجرب Linear Regression و Gradient Boosting
4. بيختار الأحسن R2 ويحفظه
5. بيطبع النتايج والـ Feature Importance

**متى تشغّله:** بعد `generate_dataset.py` مباشرة.

```bash
python src/train_model.py
```

---

### 📄 `models/fuel_efficiency_model.pkl`

**اللازمة:** الموديل المدرب والمحفوظ جاهز للاستخدام.

ملف binary بيحتوي على `GradientBoostingRegressor` المدرب. `app.py` و `streamlit_app.py` بيحملوا هذا الملف عند الـ startup ومبيعيدوش التدريب.

---

### 📄 `app.py`

**اللازمة:** REST API للموديل — بيخلي أي تطبيق تاني يستخدم الموديل.

**الـ Endpoints:**

| Method | Endpoint | الوصف |
|---|---|---|
| POST | `/predict` | بياخد JSON ويرجع actual_fuel + trend + label |
| GET | `/health` | health check للـ server |

**مثال Request:**

```json
POST /predict
{
  "avg_speed"            : 70,
  "max_speed"            : 110,
  "overspeed_ratio"      : 0.1,
  "speed_variance"       : 12,
  "trip_duration_min"    : 35,
  "distance_km"          : 24,
  "harsh_brake_count"    : 1,
  "harsh_accel_count"    : 2,
  "driver_score"         : 80,
  "driver_style"         : 1,
  "engine_cc"            : 2000,
  "weight_kg"            : 1400,
  "fuel_combined_l_100km": 8.0,
  "previous_fuel_l_100km": 9.5
}
```

**مثال Response:**

```json
{
  "actual_fuel_l_100km" : 10.15,
  "base_fuel_l_100km"   : 8.0,
  "efficiency_label"    : "Fair",
  "trend"               : "Declining",
  "trend_message"       : "6.8% worse than last trip"
}
```

**تشغيله:**
```bash
python app.py
# Server على: http://localhost:5002
```

---

### 📄 `streamlit_app.py`

**اللازمة:** واجهة مستخدم تفاعلية لتجربة الموديل بدون كود.

**بيعمل إيه:**
- Sliders وInputs لكل الـ Features مقسمة بحسب مصدرها (Trip / Driver / Vehicle Specs)
- خيار مقارنة بالرحلة السابقة
- بعد الضغط على Predict بيظهر:
  - الاستهلاك الفعلي المتوقع
  - الـ Efficiency Label
  - الـ Trend مع النسبة المئوية
  - Breakdown بالمقارنة مع الـ Base

**تشغيله:**
```bash
streamlit run streamlit_app.py
# Browser على: http://localhost:8501
```

---

### 📄 `requirements.txt`

```
flask>=2.3
pandas>=2.0
numpy>=1.24
scikit-learn>=1.3
joblib>=1.3
streamlit>=1.28
```

---

## تشغيل المشروع

### أول مرة (من الصفر)

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. توليد الداتا
python src/generate_dataset.py

# 3. تدريب الموديل
python src/train_model.py

# 4. تشغيل الـ UI
streamlit run streamlit_app.py

# أو تشغيل الـ API
python app.py
```

### بعد أول مرة (الموديل محفوظ)

```bash
# UI مباشرة
streamlit run streamlit_app.py

# أو API مباشرة
python app.py
```

---

## نتايج الموديل

### مقارنة الموديلات

| الموديل | Train R2 | Test R2 | MAE | Gap |
|---|---|---|---|---|
| **Gradient Boosting** | 0.9925 | **0.9877** | **0.19** | 0.005 ✅ |
| Linear Regression | — | 0.9770 | 0.22 | — |

### Cross Validation (5-Fold)

| Fold | R2 |
|---|---|
| Fold 1 | 0.9850 |
| Fold 2 | 0.9869 |
| Fold 3 | 0.9877 |
| Fold 4 | 0.9453 |
| Fold 5 | 0.9160 |
| **Mean** | **0.9638** |
| **Std** | **0.0286** |

### Feature Importance

| Feature | الأهمية |
|---|---|
| `driver_style` | 48.3% |
| `avg_speed` | 23.7% |
| `fuel_combined_l_100km` | 17.9% |
| `max_speed` | 4.2% |
| `harsh_accel_count` | 3.4% |
| باقي الـ Features | 2.5% |

### Sanity Check

| Driver | Predicted | Base | Over Base |
|---|---|---|---|
| 🟢 Safe (45 km/h) | 7.42 | 7.0 | +6% |
| 🟡 Normal (70 km/h) | 10.15 | 8.0 | +27% |
| 🔴 Aggressive (110 km/h) | 18.13 | 9.0 | +101% |

### تفسير النتايج

- **R2 = 0.988** يعني الموديل بيفسر 98.8% من التباين في الداتا
- **MAE = 0.19** يعني متوسط الخطأ ±0.19 لتر لكل 100 كم
- **Gap = 0.005** يعني مفيش Overfitting
- النتايج العالية مرتبطة بطبيعة الداتا الـ simulated — الموديل بيتعلم نفس المعادلة اللي ولّدت الداتا

---

> **Fuel Efficiency Model — Model 3** | Built with scikit-learn + Flask + Streamlit