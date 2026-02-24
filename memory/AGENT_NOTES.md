# Agent Operational Notes

## Critical: canonical repo path
Always work in:
`/Users/gerardobetancourt/Desktop/codex/FOCUS1-Backup-Despues-de-Reestructura-main`

Do not use:
`/Users/gerardobetancourt/Desktop/codex/FOCUS1-Backup-Despues-de-Reestrutura-main`
That directory is docs-only and causes false failures.

## Pre-flight check (mandatory before edits/deploy)
Run and verify all 3 markers exist:
- `.git`
- `backend/`
- `frontend/`

Command:
`cd /Users/gerardobetancourt/Desktop/codex/FOCUS1-Backup-Despues-de-Reestrutura-main && ls -d .git backend frontend`
