# 🔗 Unified API — Smart Car AI Assistant

> طبقة التكامل المركزية اللي بتجمع الـ 3 موديلات في API واحد — بياخد بيانات الرحلة مرة واحدة ويرجع كل النتائج (Driver Behavior + Vehicle Health + Fuel Efficiency) في response واحد.

---

## 📋 جدول المحتويات

1. [نظرة عامة](#نظرة-عامة)
2. [ليه Unified API؟](#ليه-unified-api)
3. [إزاي بيشتغل — خطوة خطوة](#إزاي-بيشتغل)
4. [الـ Input — الداتا اللي بتدخل](#الـ-input)
5. [الـ Output — الداتا اللي بتخرج](#الـ-output)
6. [الـ Endpoints](#الـ-endpoints)
7. [استراكشر الفولدر](#استراكشر-الفولدر)
8. [شرح كل ملف بالتفصيل](#شرح-الملفات)
9. [إزاي تشغّل المشروع](#تشغيل-المشروع)
10. [أمثلة كاملة](#أمثلة-كاملة)

---

## نظرة عامة

الـ Unified API هو الطبقة اللي فوق الـ 3 موديلات — مش موديل جديد، لكنه **orchestrator** بيدير المحادثة بينهم ويرجع كل النتائج في مكان واحد.

```
التليفون / App
      ↓
POST /predict  (port 5003)
      ↓
┌─────────────────────────────────────┐
│           Unified API               │
│                                     │
│  Step 1: Model 1 (Driver Behavior)  │  ← port 5000
│          ↓ driver_score             │
│          ↓ driver_style             │
│                                     │
│  Step 2: Model 2 + Model 3          │  ← port 5001 + 5002
│          (بيشتغلوا موازياً)         │
│                                     │
│  Step 3: تجميع النتائج             │
└─────────────────────────────────────┘
      ↓
Response واحد فيه كل حاجة
```

---

## ليه Unified API؟

### المشكلة قبل الـ Unified API

كل موديل عنده API منفصل — يعني التطبيق كان لازم:

```
1. POST http://localhost:5000/predict   ← Model 1
2. انتظار النتيجة
3. POST http://localhost:5001/predict-health  ← Model 2
4. انتظار النتيجة
5. POST http://localhost:5002/predict   ← Model 3
6. انتظار النتيجة
7. تجميع كل النتائج يدوياً
```

ده معناه **3 requests منفصلة + كود تجميع في التطبيق + زمن إضافي**.

### الحل بعد الـ Unified API

```
POST http://localhost:5003/predict   ← مرة واحدة بس

← كل النتائج دفعة واحدة
```

### مقارنة

| | بدون Unified API | مع Unified API |
|---|---|---|
| عدد الـ Requests | 3 | 1 |
| الزمن | متسلسل (sequential) | شبه متوازي (parallel) |
| كود التطبيق | معقد | بسيط |
| جاهزية الـ Chatbot | ❌ | ✅ summary جاهز |

---

## إزاي بيشتغل

### الخطوة 1 — استقبال الـ Request والـ Validation

الـ API بيستقبل JSON فيه بيانات الرحلة الكاملة، وبيتأكد إن كل الـ fields المطلوبة موجودة. لو فيه field ناقص بيرجع خطأ واضح فيه أسماء الـ fields الناقصة.

---

### الخطوة 2 — استدعاء Model 1 أولاً

```
Request → Model 1 (Driver Behavior) → driver_score + driver_style
```

**ليه Model 1 لازم يكون أول؟**

لأن Model 2 و Model 3 الاتنين بيحتاجوا `driver_score` و `driver_style` كـ input features. لو Model 1 فشل، مفيش فايدة نكمل — الـ API بيوقف ويرجع error واضح.

---

### الخطوة 3 — استدعاء Model 2 و Model 3 موازياً

```
driver_score + driver_style + بيانات الرحلة
        ↙                    ↘
Model 2 (Vehicle Health)    Model 3 (Fuel Efficiency)
port 5001                   port 5002
        ↘                    ↙
         بيشتغلوا في نفس الوقت
```

ده بيتم عن طريق `ThreadPoolExecutor` — الاتنين بيشتغلوا في نفس الوقت بدل ما ينتظر واحد التاني:

```python
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
    future_m2 = executor.submit(call_model, MODEL2_URL, payload_m2)
    future_m3 = executor.submit(call_model, MODEL3_URL, payload_m3)
    result_m2 = future_m2.result()
    result_m3 = future_m3.result()
```

**الفايدة:** بدل ما Model 2 ياخد 200ms و Model 3 ياخد 200ms = 400ms إجمالي، الاتنين بيشتغلوا في 200ms بس.

---

### الخطوة 4 — تجميع النتائج

الـ API بيجمع نتائج الـ 3 موديلات في response واحد منظم:

```
driver_behavior  ← من Model 1
vehicle_health   ← من Model 2
fuel_efficiency  ← من Model 3
summary          ← ملخص مختصر من الـ 3 (جاهز للـ Chatbot)
elapsed_seconds  ← زمن الـ response الكامل
```

---

## الـ Input

### الـ Fields المطلوبة

#### 📳 بيانات السنسور (من التليفون مباشرة)

| Field | النوع | الوصف | مثال |
|---|---|---|---|
| `accelerometer_data` | Array of objects | 100 قراءة من الـ Accelerometer — كل قراءة فيها x, y, z | `[{"x": 0.12, "y": 9.8, "z": 0.05}, ...]` |
| `gyroscope_data` | Array of objects | 100 قراءة من الـ Gyroscope — كل قراءة فيها x, y, z | `[{"x": 0.01, "y": 0.02, "z": 0.00}, ...]` |

> **ملاحظة:** الـ accelerometer و gyroscope arrays بتتبعت لـ Model 1 اللي بيحول الـ raw readings لـ statistical features (magnitude, std, max...) جوه الـ pipeline.

#### 📡 بيانات GPS

| Field | النوع | الوصف | مثال |
|---|---|---|---|
| `avg_speed` | float | متوسط السرعة (km/h) | `45.0` |
| `max_speed` | float | أعلى سرعة في الرحلة (km/h) | `110.0` |
| `overspeed_ratio` | float | نسبة الوقت فوق الحد المسموح (0.0 — 1.0) | `0.15` |
| `speed_variance` | float | تذبذب السرعة | `12.5` |
| `trip_duration_min` | float | مدة الرحلة (دقيقة) | `35.0` |
| `distance_km` | float | المسافة المقطوعة (km) | `24.5` |

#### 📳 أحداث القيادة (من الـ Accelerometer)

| Field | النوع | الوصف | مثال |
|---|---|---|---|
| `harsh_brake_count` | int | عدد مرات الكبح الحاد | `2` |
| `harsh_accel_count` | int | عدد مرات التسريع الحاد | `1` |

#### 🔧 مواصفات العربية (بيتدخلوا يدوياً مرة واحدة)

| Field | النوع | الوصف | مثال |
|---|---|---|---|
| `engine_cc` | int | حجم المحرك (سي سي) | `2500` |
| `engine_power_hp` | int | قوة المحرك (حصان) | `165` |
| `weight_kg` | int | وزن العربية (كيلوجرام) | `1450` |
| `fuel_combined_l_100km` | float | استهلاك الوقود المعياري | `7.8` |
| `year` | int | سنة الصنع | `2022` |

#### 🔄 Optional Fields

| Field | النوع | الوصف |
|---|---|---|
| `previous_fuel_l_100km` | float | استهلاك الرحلة اللي قبلها — لحساب الـ Trend |

---

## الـ Output

### الـ Response الكامل

```json
{
  "status": "ok",
  "elapsed_seconds": 0.213,

  "driver_behavior": {
    "score": 87.5,
    "status": "Excellent",
    "confidence": 0.96
  },

  "vehicle_health": {
    "vehicle_health_score": 78.3,
    "health_status": "Good",
    "maintenance_risk": "Medium",
    "components": {
      "engine": { "health": 82.1, "status": "Excellent" },
      "brakes": { "health": 75.4, "status": "Good" },
      "tires":  { "health": 77.4, "status": "Good" }
    },
    "alerts": [
      {
        "component": "Brakes",
        "severity": "Advisory",
        "health_score": 75.4,
        "message": "Brake health is gradually declining. Schedule a brake inspection within the next month."
      }
    ]
  },

  "fuel_efficiency": {
    "actual_fuel_l_100km": 8.61,
    "base_fuel_l_100km": 7.8,
    "efficiency_label": "Good",
    "trend": "Improving",
    "trend_message": "4.9% better than last trip"
  },

  "summary": {
    "driver_score": 87.5,
    "driver_status": "Excellent",
    "vehicle_health_score": 78.3,
    "engine_health": 82.1,
    "brake_health": 75.4,
    "tire_health": 77.4,
    "maintenance_alerts": [...],
    "fuel_l_100km": 8.61,
    "fuel_trend": "Improving",
    "fuel_label": "Good"
  }
}
```

### شرح كل Section في الـ Response

#### `driver_behavior`

| Field | الوصف | القيم |
|---|---|---|
| `score` | درجة القيادة | 0 — 100 |
| `status` | تصنيف الدرجة | Excellent / Good / Risky / Aggressive |
| `confidence` | مستوى ثقة الموديل | 0.0 — 1.0 |

#### `vehicle_health`

| Field | الوصف |
|---|---|
| `vehicle_health_score` | متوسط صحة المحرك والفرامل والإطارات |
| `health_status` | Excellent / Good / Fair / Poor |
| `maintenance_risk` | Low / Medium / High / Critical |
| `components.engine.health` | صحة المحرك (0 — 100) |
| `components.brakes.health` | صحة الفرامل (0 — 100) |
| `components.tires.health` | صحة الإطارات (0 — 100) |
| `alerts` | قايمة التنبيهات بمستوياتها (Info / Advisory / Warning / Critical) |

#### `fuel_efficiency`

| Field | الوصف |
|---|---|
| `actual_fuel_l_100km` | الاستهلاك الفعلي المتوقع للرحلة |
| `base_fuel_l_100km` | الاستهلاك المعياري من الشركة |
| `efficiency_label` | Excellent / Good / Fair / Poor |
| `trend` | Improving / Declining / Stable |
| `trend_message` | رسالة توضيحية بالنسبة المئوية |

#### `summary`

ملخص مختصر من النتائج الـ 3 — مصمم خصيصاً للـ Chatbot اللي هييجي بعدين، بيكون جاهز يتحط كـ context في الـ system prompt بدون ما يحتاج تفتش في nested objects.

---

## الـ Endpoints

### `POST /predict`

الـ endpoint الرئيسي — بيشغّل الـ 3 موديلات ويرجع النتائج كاملة.

```
URL     : http://localhost:5003/predict
Method  : POST
Headers : Content-Type: application/json
Body    : JSON (انظر قسم الـ Input)
```

**Response Codes:**

| Code | المعنى |
|---|---|
| 200 | نجاح — كل الموديلات اشتغلت |
| 400 | Missing fields في الـ input |
| 502 | Model 1 فشل — مش ممكن نكمل |
| 500 | خطأ غير متوقع |

---

### `GET /health`

بيتأكد إن الـ 3 APIs شغالين وقابلين للوصول.

```
URL    : http://localhost:5003/health
Method : GET
```

**Response لو كل حاجة تمام:**

```json
{
  "status": "ok",
  "models": {
    "model1_driver_behavior": "ok",
    "model2_vehicle_health":  "ok",
    "model3_fuel_efficiency": "ok"
  }
}
```

**Response لو في API واقع:**

```json
{
  "status": "degraded",
  "models": {
    "model1_driver_behavior": "ok",
    "model2_vehicle_health":  "unreachable",
    "model3_fuel_efficiency": "ok"
  }
}
```

---

## استراكشر الفولدر

```
Final_project/
│
├── Driver_Behavior_Model-master/
│   └── api/
│       └── app.py                  ← Model 1 API — port 5000
│
├── vehicle_health_model/
│   └── app.py                      ← Model 2 API — port 5001
│
├── fuel_efficiency_model/
│   └── app.py                      ← Model 3 API — port 5002
│
├── unified_api/
│   ├── unified_api.py              ← Unified API — port 5003 ✅
│   ├── streamlit_app.py            ← UI للتيست ✅
│   └── README.md                   ← هذا الملف ✅
│
└── main.py
```

---

## شرح الملفات

### 📄 `unified_api.py`

**الهدف:** الـ Orchestrator الرئيسي — بيستقبل الـ request ويوزعه على الـ 3 APIs ويجمع النتائج.

**أهم الأجزاء:**

`build_model1_payload` — بيجهز الـ payload الخاص بـ Model 1 (raw sensor arrays).

`build_model2_payload` — بيجهز الـ payload الخاص بـ Model 2 ويضيف عليه `driver_score` و `driver_style` الجايين من Model 1.

`build_model3_payload` — نفس Model 2 بالإضافة لـ `previous_fuel_l_100km` لو موجود.

`call_model` — wrapper function بتعمل HTTP POST لأي API وبترجع النتيجة أو رسالة خطأ واضحة.

`unified_predict` — الـ endpoint الرئيسي اللي بيشغّل كل الخطوات بالترتيب.

**تشغيله:**
```bash
python unified_api/unified_api.py
# Server على: http://localhost:5003
```

---

### 📄 `streamlit_app.py`

**الهدف:** واجهة مستخدم تفاعلية لتيست الـ Unified API بدون Postman أو كود.

**بيعمل إيه:**
- بياخد الـ inputs (driving style + trip data + car specs) من sliders وinputs
- بيولّد sensor arrays تلقائياً بناءً على الـ driving style المختار
- بيبعت request للـ Unified API ويعرض النتائج بشكل بصري:
  - Driver Score card
  - Vehicle Health score card
  - Fuel Efficiency card مع الـ Trend
  - Component Health bars للـ Engine / Brakes / Tires
  - Maintenance Alerts بالألوان
  - Raw JSON لو احتجت تشوف الـ response الكامل

**تشغيله:**
```bash
streamlit run unified_api/streamlit_app.py
# Browser على: http://localhost:8501
```

---

## تشغيل المشروع

### أولاً — تأكد إن الـ 3 APIs شغالين

كل API في Terminal منفصل:

```bash
# Terminal 1 — Model 1
cd Driver_Behavior_Model-master/api
python app.py
# ✅ Running on http://localhost:5000

# Terminal 2 — Model 2
cd vehicle_health_model
python app.py
# ✅ Running on http://localhost:5001

# Terminal 3 — Model 3
cd fuel_efficiency_model
python app.py
# ✅ Running on http://localhost:5002
```

### ثانياً — شغّل الـ Unified API

```bash
# Terminal 4
python unified_api/unified_api.py
# ✅ Running on http://localhost:5003
```

### ثالثاً — تأكد إن كل حاجة شغالة

```bash
curl http://localhost:5003/health
```

المفروض يرجع:
```json
{ "status": "ok", "models": { ... all ok ... } }
```

### رابعاً (اختياري) — شغّل الـ UI

```bash
streamlit run unified_api/streamlit_app.py
```

---

## أمثلة كاملة

### مثال 1 — Safe Driver

```json
POST http://localhost:5003/predict

{
  "accelerometer_data": [{"x": 0.05, "y": 9.78, "z": 0.03}, ...],
  "gyroscope_data":     [{"x": 0.01, "y": 0.01, "z": 0.00}, ...],
  "avg_speed": 40,
  "max_speed": 80,
  "overspeed_ratio": 0.02,
  "speed_variance": 4.0,
  "trip_duration_min": 30,
  "distance_km": 20,
  "harsh_brake_count": 0,
  "harsh_accel_count": 0,
  "engine_cc": 2500,
  "engine_power_hp": 165,
  "weight_kg": 1450,
  "fuel_combined_l_100km": 7.8,
  "year": 2022
}
```

**النتيجة المتوقعة:**
```json
{
  "driver_behavior": { "score": 92, "status": "Excellent" },
  "vehicle_health":  { "vehicle_health_score": 85, "maintenance_risk": "Low" },
  "fuel_efficiency": { "actual_fuel_l_100km": 7.95, "efficiency_label": "Excellent" }
}
```

---

### مثال 2 — Aggressive Driver مع Trend

```json
POST http://localhost:5003/predict

{
  "accelerometer_data": [{"x": 2.1, "y": 8.5, "z": 1.2}, ...],
  "gyroscope_data":     [{"x": 0.4, "y": 0.3, "z": 0.2}, ...],
  "avg_speed": 95,
  "max_speed": 160,
  "overspeed_ratio": 0.6,
  "speed_variance": 38.0,
  "trip_duration_min": 40,
  "distance_km": 60,
  "harsh_brake_count": 9,
  "harsh_accel_count": 7,
  "engine_cc": 2500,
  "engine_power_hp": 165,
  "weight_kg": 1450,
  "fuel_combined_l_100km": 7.8,
  "year": 2022,
  "previous_fuel_l_100km": 12.0
}
```

**النتيجة المتوقعة:**
```json
{
  "driver_behavior": { "score": 22, "status": "Aggressive" },
  "vehicle_health":  { "vehicle_health_score": 58, "maintenance_risk": "High",
                       "alerts": [{ "component": "Brakes", "severity": "Warning" }] },
  "fuel_efficiency": { "actual_fuel_l_100km": 15.3, "efficiency_label": "Poor",
                       "trend": "Declining", "trend_message": "27.5% worse than last trip" }
}
```

---

> **Unified API** | Smart Car AI Assistant | Built with Flask + concurrent.futures