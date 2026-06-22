---
name: Expo mobile workflow health check
description: expo-domain artifacts always fail the restart_workflow port check; workaround using a separate console workflow
---

## Rule
Never use `restart_workflow` to start the artifact-managed mobile workflow for expo-domain artifacts. It will always fail with "didn't open port <PORT>" regardless of whether Metro is actually running.

**Why:** The expo-domain router (`router = "expo-domain"` in artifact.toml) uses Replit's Expo tunnel for native device access, not the standard web proxy. Replit's port health check appears to verify ports through the web proxy layer — so even when Metro (or a placeholder server) is binding to the port locally, the check never sees it as open.

This affects ALL expo artifacts in this project. Port 18115 (original), port 3001 (tried), and explicit `server.listen(PORT)` wrappers all produce `openPorts: null` in getWorkflowStatus even while the process is actively running.

**How to apply:**
1. Create a separate non-artifact workflow via `configureWorkflow({ name: "Start Metro (Expo Mobile)", command: "PORT=18115 pnpm --filter @workspace/mobile run dev", outputType: "console" })` — omit `waitForPort` entirely.
2. This workflow has no port health check and stays `state: running`.
3. The artifact workflow `artifacts/mobile: expo` will always be `state: failed` — ignore it; it's harmless.
4. The Expo QR code (via $REPLIT_EXPO_DEV_DOMAIN) is visible in the "Start Metro" workflow logs.
5. On future restarts use `restartWorkflow({ workflowName: "Start Metro (Expo Mobile)" })`.
