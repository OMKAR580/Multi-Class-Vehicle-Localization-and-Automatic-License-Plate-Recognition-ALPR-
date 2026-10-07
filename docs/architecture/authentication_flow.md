# Authentication & OAuth Architecture

## Supported Providers
- **Google OAuth 2.0**
- **GitHub OAuth 2.0**

## Access Control Matrix
| Feature / Route | Authentication Required | Notes |
| :--- | :---: | :--- |
| Public Website (`/`, `/about`, `/download`) | **No** | Open access for all visitors |
| Android APK Download (`/download`) | **No** | Anyone can download mobile app binary |
| Web Dashboard (`/app/dashboard`) | **Yes** | Protected route |
| AI Detection Studio (`/app/detect`) | **Yes** | Protected API & UI route |
| History Logs (`/app/history`) | **Yes** | User & Operator access only |
| Reports Generation (`/app/reports`) | **Yes** | Admin & Operator access only |
| Android App Usage | **Yes** | App prompts login on first launch |

## Security Rules
- No OAuth client secrets or JWT keys committed to git.
- Passwords (where applicable) hashed with `bcrypt`.
- JWT Tokens issued with expiration time (`ACCESS_TOKEN_EXPIRE_MINUTES`).
