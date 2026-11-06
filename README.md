# 🚗 Auto Care — AI-Powered Smart Car Management

A full-stack platform that helps drivers manage their vehicles: record trips with phone sensors, score driving behavior, predict vehicle health and fuel consumption with machine learning, track maintenance and fuel, chat with an AI assistant, and share tips in a moderated community.

> Graduation project, built by a team. See [My Contribution](#my-contribution).

## Architecture

```
┌──────────────────────┐     REST + Socket.IO     ┌─────────────────────────┐
│  Mobile / Web app    │ ───────────────────────► │  NestJS API (MongoDB)   │
│  React Native + Expo │ ◄─────────────────────── │  JWT · Redis · Docker   │
└──────────────────────┘                          └────────────┬────────────┘
                                                               │ HTTP
                          ┌────────────────────────────────────▼──────────────┐
                          │  AI services (Python / Flask, Docker Compose)      │
                          │  unified API :5003 ─► driver behavior  :5000       │
                          │                    ─► vehicle health   :5001       │
                          │                    ─► fuel efficiency  :5002       │
                          │  chatbot :8000 (Groq · Llama 3.3 70B + trip data)  │
                          └────────────────────────────────────────────────────┘
```

## Features

**Drivers**
- Authentication: email OTP confirmation, login, Google Sign-In, password reset
- Vehicle setup and management, maintenance baseline
- **Trip recording** from accelerometer and gyroscope data, live tracking, trip details and weekly summary
- **Driver score**: safe vs aggressive driving classification
- **Vehicle health** scores for engine, brakes and tires, and maintenance risk
- **Fuel efficiency** prediction (L/100 km) plus fuel refill and cost tracking
- Maintenance records with upcoming-maintenance alerts
- Dashboard with aggregated stats, AI advisor and rule-based alerts
- Streaks, achievements and badges
- **AI chatbot** that answers using the user's own trips and vehicle data
- Real-time notifications and a support chat with tickets (Socket.IO)

**Community**
- Posts with likes, comments and replies, ratings and reviews
- Follow / unfollow
- Admin approval or rejection of posts before they are published

**Admin**
- Reports dashboard, post moderation, support ticket management

## Machine Learning Models

| Service | Task | Model |
|---|---|---|
| Driver behavior | Classify driving as safe or aggressive from accelerometer + gyroscope data | Random Forest |
| Vehicle health | Predict engine, brakes and tires health from trip data and car specs | Linear Regression |
| Fuel efficiency | Predict actual fuel consumption (L/100 km) | Gradient Boosting |

A unified API fans one trip out to the three models and returns a combined result to the backend. Each model has its own README with the data and the equations used.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | NestJS, TypeScript, MongoDB (Mongoose), Redis, Socket.IO, JWT, Nodemailer, Docker |
| Mobile / Web | React Native, Expo (Expo Router), TypeScript, Socket.IO client, Expo Location and Sensors |
| AI services | Python, Flask, scikit-learn, pandas, Docker Compose |
| Chatbot | Flask, Groq API (Llama 3.3 70B), MongoDB |
| Deployment | Docker (backend and AI services), Vercel (web build), EAS (mobile builds) |

## Project Structure

```
.
├── app/            # Expo Router screens (auth, trips, tracking, community, AI assistant, admin)
├── components/     # Shared UI components
├── hooks/          # useSocket, useNotifications, theme hooks
├── context/        # Theme and user profile contexts
├── constants/      # API client and config
├── backend/        # NestJS API
│   └── src/modules/  auth · user · vehicle · trip · fuel · maintenance · alert
│                     dashboard · streak · post · comment · follow · notification · support
└── ai/             # Python AI services
    ├── Driver_Behavior_Model-master/
    ├── vehicle_health_model/
    ├── fuel_efficiency_model/
    ├── unified_api/
    ├── chatbot/
    └── docker-compose.yml
```

## API Overview

| Module | Endpoints |
|---|---|
| `/auth` | `POST /signup` · `POST /login` · `POST /signup-gmail` · `POST /login-gmail` · `PATCH /confirm-Email` · `POST /resend-confirm-email` · forgot / verify / reset password · `POST /logout` |
| `/vehicle` | `POST /` · `GET /` · `GET /:id` · `GET /user/:userId` · `DELETE /:id` |
| `/trips` | `POST /` · `POST /end` · `GET /:id` · `GET /user/:userId` · `GET /weekly/me` · `GET /latest/me` · `PATCH /:id/confirm` |
| `/fuel` | CRUD · `GET /consumption/:userId` |
| `/maintenance` | CRUD · `GET /upcoming/:userId` |
| `/dashboard` · `/ai-advisor` | `GET /dashboard/:userId` · `GET /ai-advisor/dashboard/:userId` · `GET /dashboard/admin/reports` |
| `/alerts` · `/streak` | alerts by user · streak CRUD and increments |
| `/posts` · `/comments` · `/follow` | posts with like / rate / approve / reject, comments with replies, follow and followers |
| `/notifications` · `/support` | list and read-all · tickets, replies, close |

## Getting Started

**Requirements:** Node.js 20+, MongoDB, Redis on `localhost:6379`, Docker and Docker Compose, a Groq API key.

### 1. AI services

```bash
cd ai
# create a .env next to docker-compose.yml
# MONGO_URI=mongodb://...
# DB_NAME=Smart-Car-Management-System
# GROQ_API_KEY=...
docker compose up -d --build
```

### 2. Backend

```bash
cd backend
npm install
```

Create `backend/config/.env.development.local`:

```env
PORT=3000
DB_URI=mongodb://localhost:27017/Smart-Car-Management-System
UNIFIED_API_URL=http://localhost:5003

ACCESS_USER_TOKEN_SIGNATURE=change_me
JWT_SECRET=change_me
ACCESS_TOKEN_EXPIRES_IN=3600
REFRESH_TOKEN_EXPIRES_IN=604800
SALT=12
WEB_CLIENT_ID=

EMAIL=you@example.com
EMAIL_PASSWORD=app_password
```

```bash
npm run start:dev
```

### 3. Mobile / Web app

```bash
# from the repository root
npm install
npx expo start          # scan the QR code with Expo Go
npm run web             # run in the browser
```

Create a `.env` in the root with `EXPO_PUBLIC_BASE_URL=http://<your-backend-host>:3000`.

## My Contribution

> TODO: describe exactly what you built, for example "Designed and implemented the trips, fuel and dashboard modules, JWT auth, and the Socket.IO notification gateway". Recruiters read this section first on team projects.

## Team

Built collaboratively by a team of students. Contributions are visible in the Git history.

## Author

**Khaled Ali** — Backend Developer · [GitHub](https://github.com/KhaledAli1234) · [LinkedIn](https://linkedin.com/in/khaled-ali)
