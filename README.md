# MRIIQ — MRI Prior Authorization Intelligence System

> **DISCLAIMER:** **SYNTHETIC-DATA DEMO ONLY.** No real Protected Health Information (PHI) or real patient records are used at any stage. All clinical notes, patient demographics, and documents are entirely synthetic.

---

## 📌 Executive Overview
 
**MRIIQ** ([mriiq.fit](https://mriiq.fit)) is an enterprise-grade, full-stack Prior Authorization Intelligence platform designed for Lumbar Spine MRI request evaluation. It combines **agentic AI orchestration**, **the Model Context Protocol (MCP)**, **OpenAI `gpt-5.6-terra`**, **deterministic clinical decision rules**, and **human-in-the-loop (HITL) review**.

The core design principle is:
> **The LLM never makes the authorization decision.**  
> OpenAI `gpt-5.6-terra` is used strictly for natural-language clinical fact extraction. A deterministic, auditable Python rule engine evaluates criteria, and a licensed human reviewer makes the final determination.

---

## 🛠 Technology Stack

| Layer | Technologies & Libraries |
|---|---|
| **Frontend** | [Next.js](https://nextjs.org/) 16 (App Router, Turbopack), [React](https://react.dev/) 19, TypeScript, Vanilla CSS Design System |
| **Backend API** | [Python](https://www.python.org/) 3.14, [FastAPI](https://fastapi.tiangolo.com/), Uvicorn, Pydantic v2 |
| **Agentic AI Orchestrator** | [LangGraph](https://langchain-ai.github.io/langgraph/) StateGraph with `MemorySaver` checkpointer & `interrupt_before` |
| **AI Provider** | **OpenAI exclusively** — Model: `gpt-5.6-terra`, Structured Outputs via `max_completion_tokens`, TTS: `tts-1-hd` / `onyx` |
| **Tool Protocol** | **Model Context Protocol (MCP)** Python SDK v2.x (`mcp`), FastMCP Server |
| **Cloud & Data** | **Firebase** JS SDK v12.19 (Analytics, Auth, Firestore Configuration) |
| **Document Generation** | [ReportLab](https://www.reportlab.com/) synthetic clinical PDF generator |

---

## 🧠 Architectural & Authorization Workflow

```text
               ┌────────────────────────────────────────────────────────┐
               │              Next.js Frontend (MRIIQ UI)                │
               │   • Patient ID / Quick Preset Selector (P001, P002...) │
               │   • Clinical Note Editor & Synthetic PDF Previewer     │
               └───────────────────────────┬────────────────────────────┘
                                           │ POST /api/authorize
                                           ▼
               ┌────────────────────────────────────────────────────────┐
               │                   FastAPI Backend                      │
               └───────────────────────────┬────────────────────────────┘
                                           │
                                           ▼
               ┌────────────────────────────────────────────────────────┐
               │          LangGraph StateGraph Execution                │
               │                                                        │
               │  [Node 1: fetch_patient]                               │
               │     ├── Query MCP Server via Official MCP SDK          │
               │     └── get_patient(id) + get_rule()                   │
               │                                                        │
               │  [Node 2: extract]                                     │
               │     ├── OpenAI gpt-5.6-terra Structured Fact Extraction│
               │     └── Extracts: pain_weeks, physio_weeks             │
               │                                                        │
               │  [Node 3: decide]                                      │
               │     ├── Deterministic Python Rule Engine               │
               │     └── Evaluates: Plan Active? Pain ≥ 6w? Physio ≥ 6w?│
               │                                                        │
               │  [LangGraph Checkpoint Interruption]                   │
               │     └── State suspended in MemorySaver checkpointer    │
               └───────────────────────────┬────────────────────────────┘
                                           │ Returns recommendation + reasons
                                           ▼
               ┌────────────────────────────────────────────────────────┐
               │             Human Reviewer Interface                   │
               │   • Recommendation Card (APPROVE / DENY)               │
               │   • Accessibility Audio via OpenAI TTS (tts-1-hd/onyx) │
               │   • Reviewer Actions: [Approve Decision] [Reject]     │
               └───────────────────────────┬────────────────────────────┘
                                           │ POST /api/review
                                           ▼
               ┌────────────────────────────────────────────────────────┐
               │               LangGraph State Resumed                  │
               │                                                        │
               │  [Node 4: apply_review]                                │
               │     └── Applies human decision → Produces Final Outcome│
               └────────────────────────────────────────────────────────┘
```

---

## 📋 Deterministic Clinical Authorization Rules

To qualify for Lumbar Spine MRI prior authorization under clinical guideline policies:

1. **Active Coverage Plan**: Patient's health insurance plan must be active (`plan_active == True`).
2. **Conservative Therapy / Pain Duration**: Symptoms must have persisted for at least **6 weeks** (`pain_weeks >= 6`).
3. **Supervised Physical Therapy Trial**: Patient must have attempted at least **6 weeks** of conservative physical therapy (`physio_weeks >= 6`).

### Synthetic Benchmark Test Cases

| Patient ID | Synthetic Name | Plan Status | Pain Duration | Physiotherapy Trial | Rule Engine Output |
|---|---|---|---|---|---|
| **`P001`** | Alex Morgan | Active | 10 weeks | 8 weeks | **APPROVE** (All criteria met) |
| **`P002`** | Jordan Lee | Active | 9 weeks | 0 weeks (None) | **DENY** (Requires ≥ 6 weeks physio) |
| **`P003`** | Casey Kim | **Inactive** | 12 weeks | 0 weeks (None) | **DENY** (Inactive coverage & no physio) |

---

## 🤖 OpenAI Platform Integration

The application exclusively targets OpenAI:
- **Primary AI Model**: `gpt-5.6-terra`
  - Configurable via `OPENAI_MODEL=gpt-5.6-terra` in `.env`
  - Used with Pydantic structured output models and modern `max_completion_tokens` parameter.
- **Text-to-Speech (TTS)**:
  - Model: `tts-1-hd`
  - Voice: `onyx`
  - Accessible via the `/api/tts` endpoint to provide auditory playback of clinical recommendations and denial justifications.
- **Vision**:
  - Module `backend/app/agents/vision.py` for synthetic clinical note and scan interpretation.

---

## 🔥 Firebase Configuration

Firebase is installed and configured in the frontend application via [frontend/src/lib/firebase.ts](file:///d:/chancellor/MRIIQ/frontend/src/lib/firebase.ts).

Environment variables template (placeholders):
```env
NEXT_PUBLIC_FIREBASE_API_KEY="your-firebase-api-key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-project-id.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-project-id.firebasestorage.app"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your-messaging-sender-id"
NEXT_PUBLIC_FIREBASE_APP_ID="your-app-id"
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="your-measurement-id"
```

The Firebase initialization module handles Next.js Server-Side Rendering (SSR) safely, initializing `getAnalytics()` conditionally only when running in the browser.

---

## 📂 Repository File Structure

```text
MRIIQ/
├── backend/
│   ├── app/
│   │   ├── agents/
│   │   │   ├── decision.py       # Deterministic Python rule engine (APPROVE / DENY)
│   │   │   ├── reader.py         # gpt-5.6-terra structured fact extraction
│   │   │   ├── tts.py            # OpenAI TTS synthesis (tts-1-hd, onyx)
│   │   │   └── vision.py         # OpenAI Vision synthetic document reader
│   │   ├── graph/
│   │   │   ├── nodes.py          # LangGraph execution nodes
│   │   │   ├── state.py          # AuthState Pydantic / TypedDict schema
│   │   │   └── workflow.py       # StateGraph with MemorySaver & interrupt_before
│   │   ├── mcp/
│   │   │   └── client.py         # MCP client integrating FastMCP server
│   │   ├── models/
│   │   │   └── extraction.py     # Request/Response & Pydantic extraction models
│   │   ├── config.py             # Pydantic settings & env resolution
│   │   └── main.py               # FastAPI application, CORS, static routes, REST endpoints
│   └── requirements.txt          # Python dependencies
├── data/
│   ├── mock-pdfs/                # Generated synthetic clinical PDF files
│   │   ├── P001.pdf
│   │   ├── P002.pdf
│   │   └── P003.pdf
│   ├── patients.json             # Synthetic patient registry
│   ├── rule.json                 # Clinical guideline thresholds
│   ├── P001.txt / P002.txt...    # Synthetic clinical note text files
│   └── generate_mock_pdfs.py     # ReportLab script for generating PDFs
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── globals.css       # Complete dark-mode glassmorphism design system
│   │   │   ├── layout.tsx        # HTML root layout, Inter + JetBrains Mono fonts, SEO
│   │   │   └── page.tsx          # Main MRIIQ prior authorization interactive view
│   │   ├── components/
│   │   │   ├── ClinicalNote.tsx          # Note editor textarea
│   │   │   ├── FinalOutcome.tsx          # Post-review outcome banner
│   │   │   ├── HumanReview.tsx           # Approve / Reject interactive reviewer actions
│   │   │   ├── MockPdfViewer.tsx         # Embedded synthetic document PDF viewer
│   │   │   ├── PatientInput.tsx          # Patient ID selector
│   │   │   ├── RecommendationCard.tsx    # Fact extraction & rule breakdown card
│   │   │   └── TTSPlayer.tsx             # Audio TTS recommendation player
│   │   └── lib/
│   │       ├── api.ts            # Typed client for FastAPI REST endpoints
│   │       └── firebase.ts       # Firebase v12 SDK initialization
│   ├── .env                      # Frontend environment file
│   ├── .env.local                # Frontend local environment file
│   ├── package.json              # Node dependencies (Next.js 16, React 19, Firebase 12)
│   └── tsconfig.json             # TypeScript configuration with @/* alias
├── mcp_server/
│   └── server.py                 # FastMCP Python server (get_patient, get_rule)
├── .env                          # Root environment file (OpenAI + Firebase + API URLs)
├── .env.example                  # Environment template
├── .env.local                    # Root local environment file
├── test.py                       # Automated test suite (P001, P002, P003 + Rejection)
└── README.md                     # Comprehensive project documentation
```

---

## 🚀 Quick Start Guide

### Prerequisites
- Python 3.11+ (Python 3.14 supported)
- Node.js 18+ and npm
- Valid OpenAI API Key (with access to `gpt-5.6-terra`)

---

### Step 1: Clone & Configure Environment

```bash
# Configure .env with your API keys:
OPENAI_API_KEY="your-openai-api-key"
OPENAI_MODEL=gpt-5.6-terra
OPENAI_TTS_MODEL=tts-1-hd
OPENAI_TTS_VOICE=onyx
BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

### Step 2: Set Up & Test the Backend

```bash
# 1. Install backend requirements
python -m pip install -r backend/requirements.txt

# 2. Run the automated test suite
python test.py
```

#### Expected Test Output:
```text
P001: PASS  ->  Decision approved by reviewer - Recommendation: APPROVE
P002: PASS  ->  Decision approved by reviewer - Recommendation: DENY
P003: PASS  ->  Decision approved by reviewer - Recommendation: DENY
P001-REJECT: PASS  ->  Decision rejected by reviewer

All tests PASSED.
```

---

### Step 3: Launch the FastAPI Backend Service

```bash
uvicorn backend.app.main:app --reload --port 8000
```
- Interactive API Docs (Swagger): [http://localhost:8000/docs](http://localhost:8000/docs)
- Health Check: [http://localhost:8000/health](http://localhost:8000/health)
- Static Synthetic PDFs: [http://localhost:8000/mock-pdfs/P001.pdf](http://localhost:8000/mock-pdfs/P001.pdf)

---

### Step 4: Set Up & Launch the Next.js Frontend

In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🌐 Accessing the Application via MRIIQ.fit

The platform is designed to be accessible via the custom domain **[mriiq.fit](https://mriiq.fit)**.

### 1. Production Access
- **Web Application**: [https://mriiq.fit](https://mriiq.fit) (or [https://www.mriiq.fit](https://www.mriiq.fit))
- **Backend API**: [https://api.mriiq.fit](https://api.mriiq.fit)
- **API Health Check**: `https://api.mriiq.fit/health`
- **Swagger Documentation**: `https://api.mriiq.fit/docs`

---

### 2. Local Development Access via `mriiq.fit`
You can test the application locally under the custom domain `http://mriiq.fit:3000` by mapping it in your computer's local DNS hosts file:

#### On Windows:
1. Open PowerShell or Command Prompt as **Administrator**.
2. Open the hosts file:
   ```powershell
   notepad C:\Windows\System32\drivers\etc\hosts
   ```
3. Add the following lines to the bottom of the file:
   ```text
   127.0.0.1 mriiq.fit
   127.0.0.1 www.mriiq.fit
   127.0.0.1 api.mriiq.fit
   ```
4. Save and close the file.

#### On macOS / Linux:
1. Run in terminal:
   ```bash
   sudo nano /etc/hosts
   ```
2. Add:
   ```text
   127.0.0.1 mriiq.fit
   127.0.0.1 www.mriiq.fit
   127.0.0.1 api.mriiq.fit
   ```
3. Save (`Ctrl+O`, `Enter`) and exit (`Ctrl+X`).

#### Launch & Access:
Start the backend and frontend servers as usual, then navigate directly to:
👉 **[http://mriiq.fit:3000](http://mriiq.fit:3000)**

---

### 3. DNS & Production Deployment Configuration
When deploying the application to production under `mriiq.fit`:

1. **DNS Records (at your domain registrar or Cloudflare)**:
   | Type | Name / Host | Value / Target | Description |
   |---|---|---|---|
   | **A** | `@` | `<Hosting IP>` (e.g. `76.76.21.21` for Vercel) | Points root domain `mriiq.fit` to frontend |
   | **CNAME** | `www` | `cname.vercel-dns.com` (or provider CNAME) | Points `www.mriiq.fit` to frontend |
   | **CNAME** | `api` | `<Backend Host>` (e.g. Railway, Render, Fly.io) | Points `api.mriiq.fit` to FastAPI backend |

2. **Production Environment Variables**:
   In your production deployment settings (Vercel / Cloudflare / Firebase):
   ```env
   NEXT_PUBLIC_API_URL=https://api.mriiq.fit
   ```
   In your backend production settings:
   ```env
   BACKEND_URL=https://api.mriiq.fit
   ```

3. **CORS Configuration**:
   The FastAPI backend is pre-configured in `backend/app/main.py` with CORS support for all `mriiq.fit` subdomains and local ports:
   ```python
   origins = [
       "http://localhost:3000",
       "http://127.0.0.1:3000",
       "http://mriiq.fit:3000",
       "https://mriiq.fit",
       "https://www.mriiq.fit",
       "https://api.mriiq.fit",
   ]
   ```

---

## 🖥 Frontend Features & UI Capabilities

- **Quick Presets**: Single-click testing buttons for **P001 (Approve)**, **P002 (Deny — Physio)**, and **P003 (Deny — Inactive Plan)**.
- **Embedded Document Preview**: Live preview of the synthetic clinical chart PDF directly in the review screen.
- **Fact Extraction Cards**: Real-time display of conservative therapy duration (`pain_weeks`), physical therapy history (`physio_weeks`), and coverage status with visual status pills.
- **OpenAI TTS Accessibility Audio**: One-click voice readback of the authorization decision and denial reasons via `tts-1-hd` (`onyx`).
- **Human Review Decision Actions**: Actionable buttons allowing reviewers to approve the recommendation or record a human override.
- **Modern Aesthetic**: Fully responsive layout featuring glassmorphism cards, CSS micro-animations, vibrant status indicators, and custom Google Fonts typography.

---

## 🔒 Security & Privacy Practices

1. **No PHI**: The platform operates entirely on synthetic data.
2. **Server-Side API Keys**: `OPENAI_API_KEY` is only accessed on the FastAPI server backend. It is never sent to or exposed in client bundles.
3. **Stateless Resumption**: LangGraph threads maintain deterministic state without exposing sensitive internal memory to public endpoints.
4. **Git Protection**: Secret files (`.env`, `.env.local`, service accounts) are ignored in `.gitignore`.
