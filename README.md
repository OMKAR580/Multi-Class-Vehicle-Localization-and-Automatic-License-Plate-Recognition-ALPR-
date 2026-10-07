# Multi-Class Vehicle Localization and Automatic License Plate Recognition (ALPR)

[![CI Pipeline](https://github.com/your-org/vehicle-alpr-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/vehicle-alpr-platform/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Project Deadline](https://img.shields.io/badge/Target_Deadline-12_Nov_2026-amber)](https://github.com)

---

## 1. Project Title & Overview
**Multi-Class Vehicle Localization and Automatic License Plate Recognition (ALPR)** is a modern, end-to-end intelligent traffic monitoring platform designed for vehicle classification and Indian license plate extraction. The system combines YOLO-based object detection, Optical Character Recognition (OCR), a FastAPI REST backend, Next.js web studio, Kotlin Jetpack Compose Android app, and PostgreSQL/Redis infrastructure.

---

## 2. Problem Statement
Automated license plate recognition in India faces unique real-world challenges:
- High diversity in vehicle categories (Cars, Motorcycles, Auto-Rickshaws, Trucks, Buses).
- Non-standard license plate fonts, high-contrast plates, dual-line formatting, and dirt/occlusion.
- Need for unified access across field operations (Mobile App) and central command centers (Web Studio).

---

## 3. Project Objectives
- **Target Deadline:** 12 November 2026
- **Team Size:** 3-Person Engineering Team
- Build a modular, production-ready foundation supporting accurate vehicle classification and license plate recognition.
- Provide real-time inference via REST APIs and asynchronous batch processing for heavy video workloads.
- Maintain high code quality, automated CI/CD testing, strict security, and zero hardcoded credentials.

---

## 4. Feature Status Matrix

| Feature / Subsystem | Status | Description |
| :--- | :---: | :--- |
| **Monorepo Architecture** | `Implemented` | Clean layout (`frontend`, `android`, `backend`, `ai`, `database`, `docs`, `infrastructure`) |
| **Git Branch Strategy** | `Implemented` | Enforced GitFlow model (`main`, `develop`, `feature/*`, `fix/*`) |
| **FastAPI REST API Base** | `Implemented` | Async FastAPI, CORS, custom exceptions, `/api/v1` routers |
| **PostgreSQL Database Schema** | `Implemented` | SQLAlchemy 2.0 ORM models & Alembic initial migration |
| **Standard AI Output Contract**| `Implemented` | Unified Pydantic schema for Web, Android, API, and Storage |
| **Next.js Web Studio Base** | `Implemented` | Public landing pages & authenticated dashboard app routes |
| **Android Native App Foundation**| `Implemented` | Kotlin + Jetpack Compose + MVVM + Retrofit abstraction |
| **Docker Compose Orchestration**| `Implemented` | Containerized setup for Backend, Frontend, Postgres, Redis |
| **GitHub Actions CI Workflow** | `Implemented` | Automated PR checks for Frontend, Backend, AI, & Android |
| **Google / GitHub OAuth Auth** | `Planned` | Backend OAuth provider token exchange handlers |
| **YOLO + OCR Pipeline Execution**| `Planned` | Fine-tuned weights loading & real-time inference execution |
| **Celery / Redis Heavy Async Queue**| `Planned` | Video frame processing background workers |
| **Kubernetes / Multi-cluster**| `Future Scope` | Optional post-release deployment scaling |

---

## 5. System Architecture
```
                         +-----------------------------------+
                         |      Public & Web Dashboard       |
                         |       (Next.js + TypeScript)      |
                         +-----------------+-----------------+
                                           |
                                           v
+-------------------------+      +-------------------+      +------------------------+
|  Android Native Mobile  |----->|  FastAPI Backend  |<---->|   PostgreSQL Database  |
|  (Kotlin + Compose)     |      |   (Python 3.11)   |      |      (PostgreSQL 16)    |
+-------------------------+      +---------+---------+      +------------------------+
                                           |
                                           v
                                 +-------------------+
                                 | Redis Task Queue  |
                                 +---------+---------+
                                           |
                                           v
                                 +-------------------+
                                 |  AI Worker Engine |
                                 | (YOLO + OCR Model)|
                                 +-------------------+
```

---

## 6. Technology Stack
- **Frontend Web:** Next.js 14, TypeScript, Tailwind CSS
- **Android App:** Kotlin, Jetpack Compose, ViewModel, Retrofit, Navigation
- **Backend API:** Python 3.11, FastAPI, Pydantic v2, SQLAlchemy 2.0, Alembic, Passlib/Bcrypt, PyJWT
- **AI Subsystem:** PyTorch, OpenCV, YOLOv8, Tesseract/PaddleOCR
- **Database & Queue:** PostgreSQL 16, Redis 7
- **DevOps & CI:** Docker, Docker Compose, GitHub Actions

---

## 7. Repository Structure
```
vehicle-alpr-platform/
│
├── frontend/           # Next.js 14 Web Application
├── android/            # Native Android Kotlin Application
├── backend/            # FastAPI REST API & SQLAlchemy Models
├── ai/                 # Computer Vision Pipeline & Standard Output Schema
├── database/           # PostgreSQL Setup Scripts & Alembic Migrations
├── infrastructure/     # Docker Compose, Redis, Nginx configs
├── docs/               # Architecture & Technical Documentation
├── scripts/            # Local setup & foundation verification scripts
├── tests/              # Monorepo Integration & Contract Tests
├── .github/            # Workflows, Issue Templates & PR Template
├── .env.example        # Environment variable template
├── docker-compose.yml  # Multi-service local environment
├── CONTRIBUTING.md     # Git workflow & commit guidelines
├── LICENSE             # MIT License
└── README.md           # Master Documentation
```

---

## 8. Development & Setup Workflow

### Prerequisites
- Python 3.11+
- Node.js 20+ & npm 10+
- Docker & Docker Compose
- Git

### Quickstart (Local Environment)
1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-org/vehicle-alpr-platform.git
   cd vehicle-alpr-platform
   ```

2. **Setup environment variables:**
   ```bash
   cp .env.example .env
   ```

3. **Run foundation verification:**
   ```bash
   python scripts/verify_foundation.py
   ```

4. **Launch infrastructure with Docker Compose:**
   ```bash
   docker-compose up --build
   ```

5. **Access services locally:**
   - Web Studio: [http://localhost:3000](http://localhost:3000)
   - API Docs (Swagger): [http://localhost:8000/docs](http://localhost:8000/docs)
   - Health Check: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

---

## 9. Testing & Quality Assurance
Run automated tests across sub-modules:

```bash
# Backend Tests
cd backend && pytest

# AI Contract Tests
cd ai && pytest

# Root Integration & Health Verification
python scripts/verify_foundation.py
```

---

## 10. Security Guidelines
- Secrets (OAuth client secrets, JWT keys, database passwords) must **NEVER** be committed to git.
- All configuration settings are managed via `.env` files using `pydantic-settings`.
- Public routes (`/`, `/about`, `/download`) do not require authentication.
- Authenticated operational areas (`/app/*`, `/api/v1/detection`, `/api/v1/reports`) require valid OAuth/JWT tokens.

---

## 11. Team Members & Roles Placeholder
- **Member 1 (Lead Software Architect / Full-Stack):** Backend, Infrastructure, System Integration
- **Member 2 (AI / ML Engineer):** YOLO Vehicle Localization, Plate ROI Extractor, Indian OCR Fine-tuning
- **Member 3 (Mobile & Frontend Engineer):** Next.js Web Studio & Native Android Compose App
