# Contributing to Multi-Class Vehicle Localization & ALPR Platform

Thank you for contributing to the Multi-Class Vehicle Localization & ALPR Platform. To ensure a smooth collaboration among our 3-person engineering team and maintain high code quality, please adhere to the following guidelines.

---

## 1. Git Branching Strategy

Our repository uses a modified GitFlow branching model:

- **`main`**: Contains **only release-ready production code**. Direct pushes to `main` are strictly forbidden.
- **`develop`**: The main integration branch where all feature branches are merged.
- **Feature / Task Branches**: All new work must be conducted on isolated branches created off `develop`:
  - `feature/<short-description>`: New application features or components
  - `fix/<short-description>`: Bug fixes
  - `refactor/<short-description>`: Code improvements without functional changes
  - `docs/<short-description>`: Documentation additions or updates
  - `test/<short-description>`: Test suite enhancements

### Rules:
1. Always pull the latest `develop` branch before creating a new branch:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/user-authentication
   ```
2. Rebase or merge `develop` into your branch regularly to avoid large merge conflicts.
3. Submit Pull Requests targeting `develop` (never directly to `main`).

---

## 2. Commit Message Conventions

We enforce [Conventional Commits](https://www.conventionalcommits.org/) to keep our git history readable and automate changelog generation.

### Format:
`<type>(<scope>): <short description>`

### Allowed Types:
- **`feat`**: A new feature (e.g., `feat(frontend): add vehicle detection upload UI`)
- **`fix`**: A bug fix (e.g., `fix(backend): correct JWT expiration calculation`)
- **`docs`**: Documentation only changes (e.g., `docs(ai): update standard output contract schema`)
- **`refactor`**: Code change that neither fixes a bug nor adds a feature (e.g., `refactor(android): separate ViewModel state`)
- **`test`**: Adding missing tests or correcting existing tests (e.g., `test(backend): add health endpoint tests`)
- **`chore`**: Maintenance tasks, dependency updates, build configs (e.g., `chore(docker): update Postgres image tag`)
- **`perf`**: Performance improvement (e.g., `perf(ai): optimize image preprocessing speed`)

---

## 3. Pull Request (PR) Workflow

1. Open a PR from your feature branch to `develop`.
2. Fill out the PR template completely (describe changes, related issues, testing done).
3. Ensure all CI checks pass (Frontend lint/build, Backend tests, Android Gradle check, AI syntax verification).
4. Require at least **1 peer code review approval** before merging.
5. Merge using **Squash and Merge** to keep `develop` history clean.

---

## 4. Code Quality & Formatting

- **Frontend (Next.js/TS)**: Run `npm run lint` and format with Prettier.
- **Backend/AI (Python)**: Follow PEP 8 guidelines. Use `flake8` or `ruff` and type annotations where applicable.
- **Android (Kotlin)**: Follow Kotlin coding conventions and Jetpack Compose best practices.

---

## 5. Security Guidelines

- **NEVER** commit plain-text passwords, JWT secrets, OAuth client secrets, or credentials.
- Always use environment variables specified in `.env.example`.
