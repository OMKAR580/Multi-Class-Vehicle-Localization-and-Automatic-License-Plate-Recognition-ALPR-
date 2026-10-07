# Git Branch Strategy & Workflow

## Branch Rules
- `main`: Release-ready code. Protected branch. Direct pushes forbidden.
- `develop`: Integration branch for sprint development.
- `feature/*`: Isolated feature work.
- `fix/*`: Bug fixes.
- `refactor/*`: Architectural cleanups.
- `docs/*`: Documentation additions.
- `test/*`: Test coverage expansion.

## PR Requirement Checklist
1. Target branch must be `develop`.
2. All CI GitHub Actions checks must pass.
3. Require 1 peer code review approval.
