# Reusable Gemini AI Agent Engine

Initial implementation foundation for AffiliateOS and future applications. Uses the existing Google Cloud SQL PostgreSQL instance; no second database is introduced.

## Included
- Specialized worker definitions and task routing.
- Gemini structured JSON output, followed by Zod validation.
- Path allowlists, blocked-file rules, operation permissions, size limits and secret scanning.
- Approval mode and policy-gated autonomous pull-request proposal mode.
- Pluggable validation and Git integration interfaces.
- Additive SQL schema in migrations/0001_agent_engine.sql.

## Environment
Node.js 20+, existing @google/genai and zod dependencies, GEMINI_API_KEY. Optional AGENT_ENGINE_MODEL; default gemini-3.8-flash.

## Safety and execution
This package does not execute generated code. Connect a separate isolated validator (container, CPU/memory/time limits, no production credentials, restricted network) before enabling autonomous mode. Autonomous mode can propose a branch/PR only; it must not merge or deploy. Approval mode returns artifacts for human review. Keep merge and deployment as separate authorized actions.

The caller must authenticate the user and verify project ownership before invoking the engine. Treat repository content and model output as untrusted. Never store private chain-of-thought; store concise rationale and validation evidence.

## Remaining phases
Concrete Cloud SQL/Drizzle repository, durable queue, isolated sandbox validator, GitHub PR adapter, Express routes and admin UI. Migration is additive and creates a dedicated agent_engine schema.
