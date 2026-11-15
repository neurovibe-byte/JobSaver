# JobSaver

Workplace safety monitoring. Cameras watch work areas continuously, free pretrained AI models detect
safety violations (no helmet, …) and emergencies (a person lying on the floor), every incident is
saved with a snapshot, and managers get an instant Telegram alert.

```
camera (webcam / RTSP CCTV / phone / video file)
   │  frames
   ▼
backend (FastAPI) ── YOLO PPE model ──► "no_helmet" ...  ──┐
   │              └─ YOLO pose model ─► "person_down"  ───┤
   │                                                      ▼
   │                                   event + snapshot → SQLite → Telegram bot
   ▼
frontend (React) ← live MJPEG video, violations journal, emergency journal, stats
```

## Project layout

```
frontend/                    React + Vite
  src/
    main.jsx                 entry: router + auth provider
    App.jsx                  routes: /  /login  /register  /app/:tab
    lib/                     api client, UI strings, formatting helpers
    hooks/                   usePolling, useBroadcaster (device camera), useReveal
    context/AuthContext.jsx  session: login / logout / restore saved token
    components/              icons, Logo, ProtectedRoute
    pages/
      landing/               public landing page (content.js + sections/)
      auth/                  sign in / sign up
      dashboard/             shell + Overview, Cameras, Journal, Settings, ZoneEditor
    styles/base.css          theme tokens + shared building blocks
backend/                     FastAPI API, camera workers, AI detection, Telegram alerts
  app/
    main.py                  app startup, starts camera workers
    cameras.py               one worker per camera: read → analyse → record
    detection/detector.py    helmet, zone, vest, person-down, fire detection
    events.py                save snapshot, DB row, send Telegram
    settings_store.py        settings editable from the UI
    telegram.py              Telegram Bot API client
    routers/                 auth, cameras, events/stats, settings, telegram
  data/                      (git-ignored) SQLite DB, snapshots, uploaded videos, model weights
```

Frontend scripts: `npm run dev`, `npm run build`, `npm run lint`. The app uses client-side routing,
so when hosting the built `dist/` folder, serve `index.html` for unknown paths (SPA fallback).

## Running locally

Requirements: Python 3.12 with [uv](https://docs.astral.sh/uv/), Node 18+.

```bash
# 1. Backend  → http://localhost:8000  (API docs at /docs)
cd backend
cp .env.example .env          # optional, everything is configurable in the UI
uv sync
uv run uvicorn app.main:app --reload --port 8000

# 2. Frontend → http://localhost:5173  (proxies /api to the backend)
cd frontend
npm install
npm run dev
```

The first backend start downloads the two models (~30 MB) into `backend/data/models/`.
Then register, log in, open **Cameras → Add camera**:

| Source            | What to enter                                                               |
| ----------------- | --------------------------------------------------------------------------- |
| **Device camera** | Laptop or phone camera via the browser, front or back. See below            |
| Server webcam     | `0` = webcam of the machine running the backend (macOS asks your terminal for permission) |
| IP / CCTV camera  | `rtsp://user:pass@192.168.1.10:554/stream` (see the camera's manual)        |
| Phone as a camera | Install a free "IP Webcam" app → `http://<phone-ip>:8080/video`             |
| Demo video        | Switch to **Video file** and upload an mp4; it loops forever                 |

### Using a laptop or phone camera ("Device camera")

The browser captures the camera and streams frames to the backend over a WebSocket; the backend
runs detection like for any other camera and everyone sees the annotated feed. Pick **Back** or
**Front** when starting, and **Flip camera** switches while live. Streaming runs while the page is open.

- **Laptop:** works on `http://localhost:5173` directly.
- **Phone:** browsers only allow the camera on HTTPS, so start the frontend with
  `npm run dev:phone`, then on the phone (same Wi-Fi) open the `https://192.168.x.x:5173` address
  it prints, accept the self-signed certificate warning, log in, **Cameras → Add camera → Device camera**.

## What it detects

Turn each one on/off in **Settings → What to detect**. All models are free and pretrained.

| Type | Category | How |
| --- | --- | --- |
| **No helmet** | violation | Pose model finds each person's head (nose/eyes/ears); the hard-hat model (`keremberke/yolov8m-hard-hat-detection`) looks for a helmet on it. No helmet on a clearly visible head → violation. |
| **Danger zone entry** | violation | Draw a polygon on a camera (zone button on the camera card). A person whose feet (ankles) are inside it → violation. Pure geometry on the pose model, no extra model. |
| **No safety vest** | violation | *Optional model*, `Hansung-Cho/yolov8-ppe-detection` (~6 MB, MIT), downloaded when switched on. Checks the torso region of each person for a vest. |
| **Person down** | emergency | Pose model: shoulders→hips line near horizontal for 4 s. |
| **Fire / smoke** | emergency | *Optional model*, `rabahdev/fire-smoke-yolov8n` (~6 MB, AGPL), downloaded when switched on. |
| **SOS** | emergency | Manual button on each camera and in the Emergency tab. |

**Measured accuracy (helmet)** on 60 labelled test images (142 helmeted heads, 22 bare heads):
91% of bare heads caught, none mistaken for a helmet; 2% of helmeted heads wrongly flagged
(further reduced by the 3-frames-in-a-row rule). Vest and fire models are **not yet evaluated**:
test them on your own footage before relying on them.

**Avoiding spam / false alarms:** a violation must be seen in 3 consecutive analysed frames,
then the same type on the same camera isn't recorded again for 60 s (tunable in `.env`).

**Speed:** ~40 ms/frame for helmet+pose on an Apple M-series GPU; 3 analysed frames/s per camera.

### Known limitations / next steps

- The pose model is trained mostly on standing people, so it's less confident on people lying
  down: it catches clear cases but can miss some. Fine-tune on a free fall dataset (Roboflow
  Universe) with free Google Colab GPUs for production.
- Helmet check needs the face to be visible (nose/eyes/ears); people facing away aren't judged.
- Accuracy depends on camera angle, distance and lighting. Test on your real site footage.

## Telegram alerts (set up in the UI)

**Settings → Telegram**, three steps:
1. In Telegram open **@BotFather** → `/newbot` → paste the token → **Connect** (validated live).
2. Each manager sends the bot any message (or add the bot to the managers' group) →
   **Find chats** → **Add**. A chat ID can also be entered by hand.
3. Choose which event types to send → **Send test**.

Each alert contains the annotated snapshot, type, organization, camera, location, date and time
with time zone, confidence, number of people in frame and the event number. The token is stored
in the backend database and never sent back to the browser (only its last 4 characters).

## API overview

| Method | Path                             | Purpose                                 |
| ------ | -------------------------------- | --------------------------------------- |
| POST   | `/api/auth/register`, `/login`   | accounts (JWT)                          |
| GET    | `/api/cameras`                   | cameras + live status                   |
| POST   | `/api/cameras`, `/upload`        | add stream / upload video               |
| PATCH/DELETE | `/api/cameras/{id}`        | pause/resume, rename, delete            |
| GET    | `/api/cameras/{id}/stream`       | live annotated MJPEG                    |
| GET    | `/api/events?category=&type=`    | violation / emergency journal           |
| POST   | `/api/events/{id}/ack`           | mark handled                            |
| POST   | `/api/events/sos`                | manual emergency                        |
| GET    | `/api/stats?type=`               | dashboard numbers (optionally one type) |
| GET/PUT | `/api/settings`                 | detection toggles, organization         |
| *      | `/api/telegram/*`                | connect bot, find/add chats, prefs, test |
