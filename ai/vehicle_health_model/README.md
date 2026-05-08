# 🚗 Vehicle Health Model — Model 2

> نموذج تعلم آلي يتنبأ بحالة مكونات العربية (المحرك، الفرامل، الإطارات) بناءً على بيانات الرحلة من سنسورات التليفون ومواصفات العربية.

---

## 📋 جدول المحتويات

1. [نظرة عامة](#نظرة-عامة)
2. [ليه Linear Regression؟](#ليه-linear-regression)
3. [الداتا — من فين جاءت وإزاي اتحولت](#الداتا)
4. [المعادلات المستخدمة لحساب الـ Health Scores](#المعادلات)
5. [نظام الـ Alerts — Predictive Maintenance](#نظام-الـ-alerts)
6. [الـ Features الموجودة في الداتا](#الـ-features)
7. [استراكشر الفولدر](#استراكشر-الفولدر)
8. [شرح كل ملف بالتفصيل](#شرح-الملفات)
9. [إزاي تشغّل المشروع](#تشغيل-المشروع)
10. [نتايج الموديل](#نتايج-الموديل)

---

## نظرة عامة

الموديل ده جزء من منظومة أكبر بتتكون من موديلين:

```
Model 1 (Driver Scoring)  →  driver_score + driver_style
                                      ↓
Model 2 (Vehicle Health)  →  engine_health + brake_health + tire_health
```

**Model 2** بياخد بيانات الرحلة الجاية من سنسورات التليفون + output من Model 1 + مواصفات العربية، ويطلع تقرير صحة كامل للعربية.

---

## ليه Linear Regression؟

### مقارنة الموديلات

| الموديل | R2 Score | MAE | السرعة | الحجم |
|---|---|---|---|---|
| Linear Regression | **0.9658** | **2.55** | ⚡ سريع جداً | صغير جداً |
| Ridge Regression | 0.9658 | 2.55 | ⚡ سريع جداً | صغير |
| MLP Neural Net | 0.9655 | 2.56 | بطيء | كبير |
| Gradient Boosting | 0.9644 | 2.59 | متوسط | كبير |
| Random Forest | 0.9574 | 2.82 | بطيء | كبير جداً |

### سبب الاختيار

اخترنا **Linear Regression** لأن:

- **نفس الـ R2 بالظبط زي Ridge** (0.9658) — مفيش فرق في الأداء
- **أبسط موديل** — مفيش hyperparameters أو regularization إضافية
- **أسرع في الـ prediction** — مناسب جداً لـ real-time API
- **أخف على الـ memory** — مهم في بيئات الـ mobile أو الـ cloud
- **سهل التفسير** — كل feature ليها coefficient واضح

> ملاحظة: الـ R2 العالي (96.6%) مرتبط بطبيعة الداتا الـ simulated. في بيانات حقيقية، الأداء هيبقى مختلف وده طبيعي.

---

## الداتا

### المصدر الأصلي

الداتا الخام عبارة عن ملف CSV فيه مواصفات العربيات:

```
ID, brand, model, year, engine_cc, engine_power_hp, transmission,
fuel_type, weight_kg, tank_capacity_l, fuel_combined_l_100km, body_type
```

**الحجم:** 854 عربية من brands وموديلات مختلفة.

### المشكلة

مفيش بيانات رحلات حقيقية أو health labels فعلية — عندنا بس مواصفات العربيات.

### الحل — Simulation Pipeline

```
all_car_data.csv (854 عربية)
        ↓
  لكل عربية × 4 رحلات
        ↓
  توليد بيانات الرحلة (GPS + Accelerometer)
        ↓
  حساب health scores بمعادلات هندسية
        ↓
vehicle_health_dataset.csv (3,416 صف)
```

### إزاي اتولدت الرحلات

لكل عربية بيتولد 4 رحلات بـ driver styles عشوائية:

| Driver Style | الاحتمالية | خصائص الرحلة |
|---|---|---|
| Safe | 30% | سرعة منخفضة، minimal harsh events |
| Normal | 45% | سرعة متوسطة، أحداث معتدلة |
| Aggressive | 25% | سرعة عالية، harsh events كتير |

### إزاي اتحسبت الـ Health Scores

الـ scores مش عشوائية — محسوبة بمنطق هندسي مبني على عوامل حقيقية + noise بسيط يحاكي الواقع.

---

## المعادلات

### 🔧 Engine Health

```
age_factor   = clip(100 - age × 2.5,  min=10, max=100)
stress_ratio = engine_power_hp / (engine_cc / 100)
stress_pen   = clip((stress_ratio - 7) × 2,  0, 20)
accel_pen    = min(harsh_accel_count × 1.5,  15)
over_pen     = overspeed_ratio × 20

engine_health = clip(age_factor - stress_pen - accel_pen - over_pen + noise, 0, 100)
```

**المنطق:**
- كل سنة عمر زيادة = ناقص 2.5 نقطة
- المحرك اللي قوته عالية نسبة لحجمه بيتآكل أسرع (stress)
- الضغط الزيادة على البنزين (overspeed) بيأثر على المحرك

---

### 🛑 Brake Health

```
age_factor = clip(100 - age × 2.0,  min=10, max=100)
weight_pen = clip((weight_kg - 1000) / 100,  0, 15)
brake_pen  = min(harsh_brake_count × 2.0,  25)
speed_pen  = clip((max_speed - 100) × 0.15,  0, 15)

brake_health = clip(age_factor - weight_pen - brake_pen - speed_pen + noise, 0, 100)
```

**المنطق:**
- عربية تقيلة = ضغط أكبر على الفرامل
- كل harsh brake = ناقص 2 نقطة (أشد تأثيراً من الـ engine)
- سرعة عالية قبل الـ braking = تآكل أسرع

---

### 🔴 Tire Health

```
age_factor = clip(100 - age × 1.8,  min=10, max=100)
dist_pen   = clip(distance_km × 0.05,  0, 15)
weight_pen = clip((weight_kg - 1000) / 150,  0, 10)
over_pen   = overspeed_ratio × 15
var_pen    = clip(speed_variance × 0.3,  0, 10)
abuse_pen  = min((harsh_brake + harsh_accel) × 0.8,  15)

tire_health = clip(age_factor - dist_pen - weight_pen - over_pen - var_pen - abuse_pen + noise, 0, 100)
```

**المنطق:**
- الإطارات بتتأثر بأكتر عوامل (المسافة + الوزن + السرعة + التسريع + الكبح)
- speed variance عالي = قيادة غير منتظمة = تآكل جانبي
- عمرها بيتراجع بمعدل أبطأ من المحرك (1.8 بدل 2.5)

---

### 🎯 Overall Vehicle Health Score

```
vehicle_health_score = (engine_health + brake_health + tire_health) / 3
```

### تصنيف الحالة والخطورة

| النطاق | الحالة | مستوى الخطر |
|---|---|---|
| 80 — 100 | Excellent | Low |
| 60 — 79 | Good | Medium |
| 40 — 59 | Fair | High |
| 0 — 39 | Poor | Critical |

---

## نظام الـ Alerts

### الفكرة

الموديل مش بس بيحسب الـ health score — بيولّد كمان **Predictive Maintenance Alerts** تنبّه السائق قبل ما المشكلة تحصل، مش بس لما تبقى خطر فوري.

### الـ 4 Levels

| Level | النطاق | المعنى | الإجراء المطلوب |
|---|---|---|---|
| 🔴 Critical | 0 — 39 | خطر فوري | وقّف العربية واعمل فحص فوراً |
| 🟠 Warning | 40 — 59 | محتاج صيانة قريب | روح الورشة خلال أسبوعين |
| 🔵 Advisory | 60 — 74 | بيقل تدريجياً | خطط للصيانة الشهر الجاي |
| 🟢 Info | 75 — 84 | تآكل بسيط | خليك على بالك في الخدمة الجاية |
| ✅ No Alert | 85 — 100 | كل حاجة تمام | مفيش إجراء مطلوب |

### رسائل كل Component

#### 🔧 Engine

| Level | الرسالة |
|---|---|
| Critical | Engine health is critically low. Immediate inspection is required to avoid engine failure. |
| Warning | Engine health is degrading. Schedule a full engine service within the next 2 weeks. |
| Advisory | Engine health is declining. Plan a maintenance check within the next month to prevent further wear. |
| Info | Minor engine wear detected. Ensure oil levels and filters are up to date at your next service. |

#### 🛑 Brakes

| Level | الرسالة |
|---|---|
| Critical | Brake system health is critically low. Stop driving and have the brakes inspected immediately for safety. |
| Warning | Brake health is below acceptable levels. Brake pads or discs may need replacement within the next 2 weeks. |
| Advisory | Brake health is gradually declining. Schedule a brake inspection within the next month. |
| Info | Slight brake wear detected. Monitor brake performance and plan a routine check at your next service. |

#### 🔴 Tires

| Level | الرسالة |
|---|---|
| Critical | Tires are critically worn. Replace all tires immediately — continuing to drive is unsafe. |
| Warning | Tire health is low. One or more tires may need replacement within the next 2 weeks. |
| Advisory | Tire wear is above normal. Plan a tire rotation or replacement within the next month. |
| Info | Minor tire wear detected. Check tire pressure regularly and monitor tread depth. |

### شكل الـ Alert في الـ Response

كل alert في الـ JSON بيحتوي على 4 fields:

```json
{
  "component":    "Brakes",
  "severity":     "Advisory",
  "health_score": 68.5,
  "message":      "Brake health is gradually declining. Schedule a brake inspection within the next month."
}
```

### مثال Response كامل مع Alerts

```json
{
  "vehicle_health_score": 61.3,
  "health_status": "Good",
  "maintenance_risk": "Medium",
  "components": {
    "engine": {"health": 78.2, "status": "Good"},
    "brakes": {"health": 55.4, "status": "Fair"},
    "tires":  {"health": 50.3, "status": "Fair"}
  },
  "alerts": [
    {
      "component":    "Brakes",
      "severity":     "Warning",
      "health_score": 55.4,
      "message":      "Brake health is below acceptable levels. Brake pads or discs may need replacement within the next 2 weeks."
    },
    {
      "component":    "Tires",
      "severity":     "Warning",
      "health_score": 50.3,
      "message":      "Tire health is low. One or more tires may need replacement within the next 2 weeks."
    }
  ]
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
| `engine_power_hp` | قوة المحرك | حصان |
| `weight_kg` | وزن العربية | كيلوجرام |
| `fuel_combined_l_100km` | استهلاك الوقود | لتر/100كم |
| `year` | سنة الصنع | — |

### الـ Targets (اللي الموديل بيتنبأ بيها)

| Target | الوصف | النطاق |
|---|---|---|
| `engine_health` | صحة المحرك | 0 — 100 |
| `brake_health` | صحة الفرامل | 0 — 100 |
| `tire_health` | صحة الإطارات | 0 — 100 |

---

## استراكشر الفولدر

```
vehicle_health_model/
│
├── 📁 data/
│   ├── 📁 raw/
│   │   └── all_car_data.csv          ← الداتا الخام (مواصفات العربيات)
│   └── 📁 processed/
│       └── vehicle_health_dataset.csv ← الداتا بعد التوليد (جاهزة للتدريب)
│
├── 📁 models/
│   └── vehicle_health_model.pkl      ← الموديل المدرب والمحفوظ
│
├── 📁 src/
│   ├── generate_dataset.py           ← يولد الداتا من الـ CSV
│   └── train_model.py                ← يدرب الموديل ويحفظه
│
├── app.py                            ← Flask REST API
├── streamlit_app.py                  ← واجهة المستخدم التفاعلية
├── requirements.txt                  ← المكتبات المطلوبة
└── README.md                         ← هذا الملف
```

---

## شرح الملفات

### 📄 `data/raw/all_car_data.csv`

**اللازمة:** الداتا الأساسية اللي المشروع كله بيبدأ منها.

يحتوي على مواصفات 854 عربية مختلفة: brand, model, year, engine specs, weight, fuel consumption, body type. ده المصدر الوحيد للبيانات الحقيقية في المشروع — كل حاجة تانية اتولدت منه.

---

### 📄 `data/processed/vehicle_health_dataset.csv`

**اللازمة:** الداتا الجاهزة للتدريب — المخرج من `generate_dataset.py`.

يحتوي على 3,416 صف (854 عربية × 4 رحلات). كل صف فيه الـ 15 feature + الـ 3 health scores كـ labels. الموديل بيتدرب على هذا الملف مباشرة.

---

### 📄 `src/generate_dataset.py`

**اللازمة:** تحويل مواصفات العربيات لداتا تدريب كاملة.

**بيعمل إيه:**
1. بيقرأ `all_car_data.csv`
2. لكل عربية بيولد 4 رحلات بـ driver styles مختلفة
3. لكل رحلة بيحسب بيانات GPS (speed, distance) وAccelerometer (harsh events)
4. بيطبق المعادلات الهندسية لحساب engine/brake/tire health
5. بيحفظ النتيجة في `vehicle_health_dataset.csv`

**متى تشغّله:** مرة واحدة في البداية، أو لو اتغير الـ CSV الأصلي أو المعادلات.

```bash
python src/generate_dataset.py
```

---

### 📄 `src/train_model.py`

**اللازمة:** تدريب الموديل وحفظه.

**بيعمل إيه:**
1. بيقرأ `vehicle_health_dataset.csv`
2. بيعمل Train/Test Split (80% / 20%)
3. بيشغّل 5-Fold Cross Validation وبيطبع النتايج
4. بيدرّب `MultiOutputRegressor(LinearRegression())` على كل الـ train set
5. بيطبع per-target metrics (R2 و MAE لكل component)
6. بيحفظ الموديل في `models/vehicle_health_model.pkl`
7. بيعمل Sanity Check بـ sample واحد

**متى تشغّله:** بعد `generate_dataset.py` مباشرة، أو لو عايز تعيد التدريب.

```bash
python src/train_model.py
```

---

### 📄 `models/vehicle_health_model.pkl`

**اللازمة:** الموديل المدرب والمحفوظ جاهز للاستخدام.

ملف binary بيحتوي على `MultiOutputRegressor` اللي فيه 3 Linear Regression models — واحد لكل target. `app.py` و `streamlit_app.py` بيحملوا هذا الملف عند الـ startup ومبيعيدوش التدريب.

---

### 📄 `app.py`

**اللازمة:** REST API للموديل — بيخلي أي تطبيق تاني يستخدم الموديل.

**الـ Endpoints:**

| Method | Endpoint | الوصف |
|---|---|---|
| POST | `/predict-health` | بياخد JSON ويرجع health scores + alerts |
| GET | `/health` | health check للـ server |

**مثال Request:**

```json
POST /predict-health
{
  "avg_speed": 70,
  "max_speed": 110,
  "harsh_brake_count": 3,
  "harsh_accel_count": 2,
  "overspeed_ratio": 0.1,
  "speed_variance": 12.5,
  "trip_duration_min": 35,
  "distance_km": 28.5,
  "driver_score": 75,
  "driver_style": "Normal",
  "engine_cc": 1600,
  "engine_power_hp": 110,
  "weight_kg": 1200,
  "fuel_combined_l_100km": 8.0,
  "year": 2018
}
```

**مثال Response:**

```json
{
  "vehicle_health_score": 74.2,
  "health_status": "Good",
  "maintenance_risk": "Medium",
  "components": {
    "engine": {"health": 76.6, "status": "Good"},
    "brakes": {"health": 77.9, "status": "Good"},
    "tires":  {"health": 68.1, "status": "Good"}
  },
  "alerts": [
    {
      "component":    "Engine",
      "severity":     "Info",
      "health_score": 76.6,
      "message":      "Minor engine wear detected. Ensure oil levels and filters are up to date at your next service."
    }
  ]
}
```

**تشغيله:**
```bash
python app.py
# Server على: http://localhost:5001
```

---

### 📄 `streamlit_app.py`

**اللازمة:** واجهة مستخدم تفاعلية لتجربة الموديل بدون كود.

**بيعمل إيه:**
- Sidebar فيه sliders وinputs لكل الـ 15 feature مقسمة بحسب مصدرها (GPS / Accelerometer / Driver / Vehicle Specs)
- بعد الضغط على "Run Prediction" بيظهر:
  - Overall health score مع risk badge
  - 3 component cards مع progress bars
  - Alerts لو في مشكلة
  - Input summary قابل للتوسع

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

### Cross Validation (5-Fold)

| Metric | القيمة |
|---|---|
| R2 Score | 0.9659 ± 0.0012 |
| MAE | 2.55 ± 0.05 |

### Per-Target Metrics (Test Set)

| Target | R2 | MAE |
|---|---|---|
| Engine Health | 0.9734 | 2.59 |
| Brake Health | 0.9629 | 2.58 |
| Tire Health | 0.9601 | 2.50 |

### تفسير النتايج

- **R2 = 0.966** يعني الموديل بيفسر 96.6% من التباين في الداتا
- **MAE = 2.55** يعني متوسط الخطأ ±2.55 نقطة من أصل 100
- النتايج العالية مرتبطة بطبيعة الداتا الـ simulated — الموديل بيتعلم نفس المعادلات اللي ولّدت الداتا

---

> **Vehicle Health Model — Model 2** | Built with scikit-learn + Flask + Streamlit