# Monorepo Structure Reference

```
vehicle-alpr-platform/
│
├── frontend/           # Next.js 14, TypeScript, Tailwind CSS Web Portal
├── android/            # Native Android Kotlin application (Jetpack Compose)
├── backend/            # FastAPI REST API, SQLAlchemy models, Pydantic schemas
├── ai/                 # Computer vision pipeline (YOLO localization & Indian Plate OCR)
├── database/           # Init SQL scripts, Alembic migrations, schema docs
├── infrastructure/     # Docker Compose, Redis & Nginx reverse proxy configs
├── docs/               # System documentation & technical contracts
├── scripts/            # Local developer automation & environment verification
├── tests/              # End-to-end integration and contract validation tests
├── .github/            # GitHub Actions CI workflows & issue/PR templates
│   ├── workflows/
│   ├── ISSUE_TEMPLATE/
│   └── PULL_REQUEST_TEMPLATE.md
│
├── .env.example        # Environment variable configuration template
├── .gitignore          # Monorepo git exclusion rules
├── docker-compose.yml  # Local multi-service orchestration
├── CONTRIBUTING.md     # Engineering team workflow rules & commit conventions
├── LICENSE             # MIT License
└── README.md           # Master project overview
```
