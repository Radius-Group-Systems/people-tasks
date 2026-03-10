# PeopleTasks — Tech Stack & Infrastructure

> People-centric task manager with AI extraction, multi-tenancy, and external integrations.
> Last updated: 2026-03-10

---

## Architecture Overview

```
GitHub (push to main)
    ↓
GitHub Actions (OIDC → AWS)
    ├→ ECR (Docker image)
    └→ ECS (force deploy)
         ↓
ECS Fargate Cluster
    ├── Container: Next.js app (port 3000)
    │   ├── S3 (file storage)
    │   ├── Bedrock (AI inference)
    │   ├── SNS (SMS notifications)
    │   └── RDS PostgreSQL + pgvector
    ├── ALB (HTTP/HTTPS → port 3000)
    └── EventBridge + Lambda (cron every 15 min)
```

---

## Application Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.1.6 |
| Runtime | Node.js | 20 (Alpine) |
| Language | TypeScript | 5 |
| React | React | 19.2.3 |
| CSS | Tailwind CSS | 4 |
| UI Components | shadcn/ui (New York style) | — |
| Component Variants | class-variance-authority (CVA) | — |
| Icons | Lucide React | — |
| Auth | NextAuth.js | 5.0.0-beta.30 |
| Database | PostgreSQL + pgvector | 16 |
| DB Client | pg (node-postgres) | — |
| Build Output | Standalone | — |

### Brand System
- **Design Tokens**: Radius warm monochrome palette
- **Brand Font**: Zilla Slab (slab-serif, wordmark)
- **UI Font**: DM Sans (headings + body)
- **Code Font**: JetBrains Mono

---

## Hosting & Infrastructure

### AWS — Primary Cloud (us-east-1)

| Service | Purpose |
|---------|---------|
| **ECS Fargate** | Application hosting (512 CPU / 1024 MB) |
| **ECR** | Docker image registry (`people-tasks`) |
| **ALB** | Load balancer (HTTP/HTTPS, health check on `/api/auth/session`) |
| **RDS PostgreSQL 16** | Primary database with pgvector extension |
| **S3** | File storage (photos, uploads, emails) — signed URLs, 1hr expiry |
| **Bedrock** | AI inference (Claude Sonnet 4.5 — `us.anthropic.claude-sonnet-4-5-20250929-v1:0`) |
| **SNS** | Transactional SMS notifications |
| **EventBridge** | Cron schedule (every 15 min → notification Lambda) |
| **Lambda** | Notification processor (nodejs20.x, calls `/api/notifications/process`) |
| **CloudWatch** | Logs (`/ecs/people-tasks`, 30-day retention) + Container Insights |
| **IAM** | Task execution role, task role, GitHub Actions OIDC role |

### Infrastructure-as-Code

| File | Purpose |
|------|---------|
| `infra/deploy-infra.yml` | Main CloudFormation template (ECS, ECR, ALB, IAM, EventBridge, Lambda) |
| `infra/sms-notifications.yml` | SNS permissions for ECS task role |

---

## CI/CD Pipeline

**File**: `.github/workflows/deploy.yml`
**Trigger**: Push to `main` or manual dispatch
**Region**: `us-east-1`

1. Checkout code
2. Assume AWS role via OIDC (`${{ secrets.AWS_DEPLOY_ROLE_ARN }}`)
3. Login to Amazon ECR
4. Build Docker image (multi-stage: deps → build → runner)
5. Tag with git SHA + `latest`, push to ECR
6. Update ECS service with `--force-new-deployment`

### Container Startup
1. Run migrations (`/scripts/run-migrations.sh`)
2. Start Next.js standalone server (`node server.js` on `0.0.0.0:3000`)

---

## Database

- **Engine**: PostgreSQL 16 with pgvector extension
- **Multi-tenancy**: Row-Level Security (RLS) with `app.current_org_id` session variable
- **Migrations**: 16 sequential SQL files in `/migrations/`, auto-run on container start
- **Connection**: SSL in production (`rejectUnauthorized: false`), pooled via `pg`

### Key Tables
| Table | Purpose |
|-------|---------|
| `users` | Accounts with `password_hash` (bcryptjs) |
| `accounts` | OAuth provider records (NextAuth) |
| `organizations` | Multi-tenant orgs |
| `org_members` | User ↔ org membership + roles |
| `people` | Contact/person records |
| `encounters` | Meetings, calls, interactions |
| `action_items` | Tasks with priority, delegation chains |
| `calendar_events` | Synced Google Calendar events |
| `embeddings` | Vector storage for hybrid search |
| `settings` | Key-value config (tokens, preferences) |
| `notification_log` | SMS deduplication |

### Local Development Database
```
docker-compose.yml → PostgreSQL 16 + pgvector
Host: localhost:5433
Credentials: see docker-compose.yml
```

---

## Authentication

- **Library**: NextAuth.js v5 (JWT strategy, stateless sessions)
- **Providers**:
  - Google OAuth
  - Credentials (email + bcrypt password)
- **Session**: Enriched with `userId`, `orgId`, `role`
- **Middleware**: Redirects unauthenticated users; sets RLS context per request

---

## External Integrations

| Service | Library | Purpose |
|---------|---------|---------|
| **Google Calendar** | `googleapis` v171.4.0 | OAuth2 flow, event sync (`calendar.readonly` scope) |
| **Slack** | `@slack/web-api` v7.14.1 | Post task notifications, user lookup by email |
| **Email (SMTP)** | `nodemailer` v8.0.1 | Send emails |
| **Email (IMAP)** | `imapflow` v1.2.10 + `mailparser` v3.9.3 | Import emails, extract action items |
| **AWS Bedrock** | `@aws-sdk/client-bedrock-runtime` | AI text extraction, summarization, embeddings |
| **AWS S3** | `@aws-sdk/client-s3` + presigner | File storage with signed URLs |
| **AWS SNS** | `@aws-sdk/client-sns` | Transactional SMS delivery |

---

## Environment Variables

### Required for Production

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Session encryption key (`openssl rand -hex 32`) |
| `NEXTAUTH_URL` | Public app URL (e.g., `https://tasks.radiusgroup.com`) |
| `AWS_REGION` | AWS region (default: `us-east-1`) |
| `CRON_SECRET` | Shared secret for `/api/notifications/process` |

### Optional

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL |
| `S3_BUCKET` | S3 bucket name for file storage |
| `S3_REGION` | S3 region (defaults to `AWS_REGION`) |
| `SLACK_BOT_TOKEN` | Slack bot token (can also be stored in DB settings) |
| `BEDROCK_MODEL_ID` | Bedrock model (default: Claude Sonnet 4.5) |

---

## API Routes

### AI & Search
| Route | Service | Description |
|-------|---------|-------------|
| `POST /api/encounters/[id]/extract` | Bedrock | AI extraction from meeting transcripts |
| `POST /api/encounters/[id]/summarize` | Bedrock | AI summarization |
| `GET /api/search` | Bedrock + pgvector | Hybrid search with embeddings |
| `POST /api/prep` | Bedrock | Meeting prep generation |

### Files & Storage
| Route | Service | Description |
|-------|---------|-------------|
| `GET /api/files/[...key]` | S3 | File proxy with signed URLs |
| `POST /api/people/[id]/photo` | S3 | Photo upload |
| `POST /api/upload` | S3 | General file uploads |

### Communications
| Route | Service | Description |
|-------|---------|-------------|
| `POST /api/slack/send` | Slack | Post task to Slack channel/user |
| `POST /api/sms/send` | SNS | Send SMS notification |
| `POST /api/sms/verify` | SNS | Send verification code |
| `POST /api/sms/confirm` | — | Confirm verification code |
| `POST /api/email/send` | Nodemailer | Send email |
| `POST /api/email/import` | IMAP | Import emails from inbox |

### Calendar
| Route | Service | Description |
|-------|---------|-------------|
| `GET /api/calendar/auth` | Google OAuth | Start OAuth flow |
| `GET /api/calendar/callback` | Google OAuth | OAuth callback |
| `POST /api/calendar/sync` | Google Calendar | Sync events |

### Notifications
| Route | Service | Description |
|-------|---------|-------------|
| `POST /api/notifications/process` | SNS/Slack/Email | Cron-triggered dispatcher (every 15 min via EventBridge) |

---

## Project Structure

```
people-tasks/
├── .github/workflows/deploy.yml    # CI/CD pipeline
├── infra/
│   ├── deploy-infra.yml            # Main CloudFormation
│   └── sms-notifications.yml       # SMS infrastructure
├── migrations/                     # 16 SQL migration files
├── scripts/run-migrations.sh       # Migration runner
├── Dockerfile                      # Multi-stage build (node:20-alpine)
├── docker-compose.yml              # Local dev database
├── docker-compose.prod.yml         # Full local stack
├── next.config.ts                  # Standalone output
├── src/
│   ├── auth.ts                     # NextAuth config
│   ├── middleware.ts               # Auth + RLS middleware
│   ├── app/
│   │   ├── layout.tsx              # Root layout (DM Sans, Zilla Slab, JetBrains Mono)
│   │   ├── globals.css             # Radius brand design tokens
│   │   ├── page.tsx                # Today dashboard
│   │   ├── login/                  # Login (dark hero + glow arcs)
│   │   ├── register/               # Registration
│   │   ├── onboarding/             # First-run setup
│   │   ├── people/                 # People directory + profiles
│   │   ├── projects/               # Projects + detail views
│   │   ├── tasks/                  # My Tasks
│   │   ├── waiting/                # Waiting On
│   │   ├── encounters/             # Encounter list + detail
│   │   ├── review/                 # Encounter review
│   │   ├── prep/                   # Meeting prep
│   │   ├── search/                 # Hybrid search
│   │   ├── import/                 # Data import
│   │   ├── settings/               # User settings
│   │   └── api/                    # 50+ API routes
│   ├── components/
│   │   ├── ui/                     # shadcn/ui components
│   │   ├── radius-brand.tsx        # RadiusWordmark, RadiusIconMark, RadiusGlowArc
│   │   ├── nav.tsx                 # Main navigation
│   │   ├── quick-capture.tsx       # Quick task entry
│   │   └── ...                     # Other components
│   ├── lib/
│   │   ├── db.ts                   # PostgreSQL + TenantDb
│   │   ├── bedrock.ts              # AWS Bedrock client
│   │   ├── storage.ts              # S3 client
│   │   ├── sms.ts                  # SNS + phone utils
│   │   ├── slack.ts                # Slack Web API
│   │   ├── calendar.ts             # Google Calendar
│   │   ├── extractor.ts            # AI extraction
│   │   ├── summarizer.ts           # AI summarization
│   │   ├── embeddings.ts           # Vector embeddings
│   │   └── utils.ts                # cn() helper
│   └── types/                      # TypeScript types
└── package.json
```

---

## Security

- **Auth**: JWT sessions, bcrypt passwords, OIDC for CI/CD
- **Database**: Row-Level Security (RLS) enforced per request via middleware
- **Storage**: S3 signed URLs (1-hour expiry), no direct public access
- **SMS**: SNS transactional type, deduplication via `notification_log`
- **SSL**: Enforced for production database connections
- **Secrets**: Managed via CloudFormation `NoEcho` parameters + GitHub Secrets
