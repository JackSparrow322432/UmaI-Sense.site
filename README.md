Umai Sense

AI-powered decision-support platform for parents, specialists, and educational organizations supporting a child's development.

Table of Contents
Overview
The Problem
Development Status
Tech Stack
Architecture
AI Recommendation Engine
Data Model
Roles
Project Structure
Environment Variables
Local Development
Deployment
API Overview
Overview

Umai Sense brings together data on the child's state, the parent's state, and specialists' observations into a single recommendation system grounded in data, neurophysiology, and a proprietary methodology developed by the company's co-founder.

Most existing apps just hand out generic exercises. Umai Sense instead helps people make decisions — factoring in the individual profile of the child and the family's current emotional and practical state — rather than producing a one-size-fits-all checklist.

The Problem

Parents are left with a flood of contradictory advice, specialists work in isolation from one another, and decisions about a child's support are made intuitively rather than continuously, with no data link between home, school, and rehabilitation. Umai Sense closes that loop: a single profile, a shared timeline of observations, and recommendations that update as the child's and family's situation changes.

Development Status

The backend is built and under active development. It is a fully functional REST API with working authentication, a role model, AI integration, and file storage — the product has moved past the concept stage and has a working technical foundation. The frontend (React SPA) implements the full user flow: registration/OTP, child profiles, daily observations, milestones, AI recommendations, notifications, an admin panel, and a public articles section.

Both are deployed together as a single Vercel project, with the Express API running as a serverless function behind the static frontend build.

Tech Stack
Backend
Layer	Technology
Language / runtime	TypeScript, Node.js
Web framework	Express 5
Database	MongoDB (Mongoose ODM)
Authentication	JWT + email OTP, bcrypt for password hashing
Files / images	Cloudinary (image hosting), Multer (uploads)
Email	Nodemailer (SMTP — Gmail, Brevo, SendGrid, Mailgun, etc.)
AI provider	OpenAI API (gpt-4o-mini)
API protection	express-rate-limit, whitelisted-origin CORS
Frontend
Layer	Technology
Framework	React 19 + TypeScript
Build tool	Vite 7
Styling	Tailwind CSS 4
Routing	React Router 7
State management	Zustand
HTTP client	Axios
Notifications (UI)	Sonner
Infrastructure
Layer	Technology
Hosting	Vercel (single project — static frontend + serverless API)
Database hosting	MongoDB Atlas
Architecture

The backend follows a classic layered structure — routes → controllers → models — cleanly split by domain:

users · children · emotions · activities · diary
milestones · recommendations · notifications
articles · invites · admin

For serverless deployment, the Express app is built once via createApp() (with a cached MongoDB connection across invocations) and mounted behind a single api/index.ts entry point, while src/index.ts remains the traditional entrypoint for local development (npm run dev) and non-serverless hosts (VPS, Docker, Railway, Render).

AI Recommendation Engine

The core technical asset of the product is the personalized recommendation engine (recommendations.controller). It:

Gathers the child's profile — diagnosis, communication method, triggers, fears, interests, sensory profile (reaction to sound/light/touch) — plus recent history: mood entries, activities, and diary observations.
Builds a structured prompt and sends it to OpenAI, requesting a response strictly as JSON across four categories: calming techniques, activities for today, communication tips, and points of attention.
Includes a built-in fallback content set for cases when the API key is missing or the response fails to parse — the platform never breaks or shows a blank screen, it still returns baseline recommendations.
Automatically creates a user notification once new recommendations are ready.

This directly implements the product's core claim — "the platform helps make decisions rather than just handing out exercises" — factoring in the family's emotional state and load, not just the child's metrics.

Data Model
Entity	Description
User	Roles: parent / trainer / admin. Email + OTP verification, JWT sessions.
Child	Profile: diagnosis, triggers, fears, interests, sensory profile, goals, linked specialists (trainers).
Emotion / Activity / DiaryEntry	Daily observations that feed the AI recommendation engine.
Milestone / ChildMilestone	A bank of developmental milestones across domains (cognitive, motor, social, speech, self-care) and per-child achievement status — the foundation for tracking developmental progress over time.
InviteCode	Legacy parent-issued invite codes (creation is now admin-only; kept for backward compatibility).
EnrollmentRequest	Parent's request to enroll a child: preferred weekdays/time, contact phone, comment. Status: pending / approved / cancelled.
Assignment	Admin-created enrollment of a child with a trainer: weekly slots, duration, period and a one-time access code the trainer must enter to get access.
Session	Concrete calendar session (date + start/end time as local strings) generated from an assignment; can be cancelled individually by the admin.
Recommendation	AI-generated recommendation sets, tied to a child and a point in time.
Notification	In-app notification feed (new recommendations, invites, milestones, etc.).
Article	Educational content, managed through the admin panel.
Roles
Parent — creates and manages a child's profile (last name, IIN and prior adaptive-skating experience are required), submits enrollment requests with preferred days, sees the schedule, logs observations, receives recommendations.
Trainer (specialist) — is assigned to a child by the admin, receives an access code (in-app notification + email), enters it to open the child's card (child & parent names, IIN, days) and profile, logs observations from their side.
Admin — processes enrollment requests (assigns children to trainers on specific days, cancels requests/assignments/single sessions), sees the full schedule, manages users and published articles through a dedicated admin panel (/admin). The admin account is not self-registered — it is seeded automatically on server start from ADMIN_EMAIL / ADMIN_PASSWORD environment variables.
Project Structure
.
├── api/
│   └── index.ts                 # Vercel serverless entrypoint
├── umaisense-back-main/
│   └── src/
│       ├── controllers/         # Business logic per domain
│       ├── models/              # Mongoose schemas
│       ├── routes/              # Express routers
│       ├── middleware/          # Auth guard, etc.
│       ├── utils/               # Email, uploads, seeding, DB connection
│       ├── createApp.ts         # Serverless-safe Express app factory
│       └── index.ts             # Traditional entrypoint (local/VPS)
├── umiasense-front-main/
│   └── src/
│       ├── api/                 # Axios client + endpoint wrappers
│       ├── components/          # Shared UI components
│       ├── pages/                # Route-level pages (auth, children, admin, ...)
│       ├── store/               # Zustand stores
│       └── hooks/
└── vercel.json                  # Monorepo build/rewrite configuration
Environment Variables

Set these in the backend (or in the Vercel project's Environment Variables for the combined deployment):

env
PORT=5000
NODE_ENV=development

MONGO_URI=mongodb://localhost:27017/umai_sense

JWT_SECRET=your_super_secret_key_here

CLIENT_URL=http://localhost:5173

# SMTP (email OTP) — works with Gmail, Brevo, SendGrid, Mailgun, etc.
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=your_smtp_password

# Cloudinary (image hosting)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Admin account (seeded automatically on server start)
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=your_admin_password

# AI provider
OPENAI_API_KEY=your_openai_api_key

# Time zone used to decide which sessions are "past" (optional)
APP_TZ=Asia/Almaty

If CLOUDINARY_* variables are not set, image uploads fall back to local disk storage (suitable for local development only — not for serverless hosting). If OPENAI_API_KEY is not set, the recommendation engine falls back to built-in baseline content instead of failing.

Local Development

Backend

bash
cd umaisense-back-main
npm install
cp .env.example .env   # fill in the values above
npm run dev             # http://localhost:5000

Frontend

bash
cd umiasense-front-main
npm install
npm run dev              # http://localhost:5173
Deployment

Production hosting in Kazakhstan (personal-data localization, fault tolerance): see DEPLOY_FREEDOM_CLOUD.md and the deploy/ folder.

The project is deployed as a single Vercel project (static frontend + serverless API), configured via a root-level vercel.json:

buildCommand builds the frontend (umiasense-front-main) into umiasense-front-main/dist.
installCommand installs backend dependencies so the serverless function can build.
api/index.ts exports the Express app (via createApp()) as a Vercel serverless function.
Rewrites route /api/* to the serverless function and everything else to index.html (SPA fallback).

MongoDB Atlas is used as the database, with network access opened to 0.0.0.0/0 (required since Vercel serverless functions have no fixed outbound IP).

API Overview

All routes are prefixed with /api.

Domain	Base path
Auth (OTP registration, login, password reset, profile)	/api/auth
Children profiles	/api/children
Specialist invites	/api/invites
Emotion entries	/api/emotions
Activities	/api/activities
Observation diary	/api/diary
Developmental milestones	/api/milestones
AI recommendations	/api/recommendations
Notifications	/api/notifications
Image uploads	/api/upload
Admin (users, articles management)	/api/admin
Public articles	/api/articles
Enrollment requests, trainer assignments, schedule	/api/enrollment
Health check	/api/health
