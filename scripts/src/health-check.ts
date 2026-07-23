#!/usr/bin/env tsx
/**
 * Post-publish smoke test.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run health-check https://vispix.example.com
 *   # or
 *   BASE_URL=https://vispix.example.com pnpm --filter @workspace/scripts run health-check
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — one or more checks failed
 */

interface CheckResult {
  name: string;
  url: string;
  status: number | null;
  passed: boolean;
  detail: string;
}

const TIMEOUT_MS = 15_000;

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function check(
  name: string,
  url: string,
  expectExact?: number,
): Promise<CheckResult> {
  let status: number | null = null;
  try {
    const res = await fetchWithTimeout(url);
    status = res.status;

    if (expectExact !== undefined) {
      const passed = status === expectExact;
      return {
        name,
        url,
        status,
        passed,
        detail: passed
          ? `HTTP ${status}`
          : `expected ${expectExact}, got ${status}`,
      };
    }

    const passed = status < 500;
    return {
      name,
      url,
      status,
      passed,
      detail: passed ? `HTTP ${status}` : `server error HTTP ${status}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { name, url, status, passed: false, detail: `request failed: ${msg}` };
  }
}

async function main(): Promise<void> {
  const baseUrl = (process.argv[2] ?? process.env.BASE_URL ?? "").replace(/\/$/, "");

  if (!baseUrl) {
    console.error(
      "Usage: health-check <BASE_URL>\n" +
        "  e.g. health-check https://vispix.example.com\n" +
        "  or   BASE_URL=https://vispix.example.com health-check",
    );
    process.exit(1);
  }

  console.log(`\n🔍  Smoke-testing ${baseUrl}\n`);

  const checks = await Promise.all([
    check("healthz (server + DB)", `${baseUrl}/api/healthz`, 200),
    check("albums endpoint",        `${baseUrl}/api/albums`),
    check("photos endpoint",        `${baseUrl}/api/photos`),
    check("collections endpoint",   `${baseUrl}/api/collections`),
    check("stats/dashboard",        `${baseUrl}/api/stats/dashboard`),
    check("search endpoint",        `${baseUrl}/api/search?q=test`),
    check("web frontend",           `${baseUrl}/`),
  ]);

  const WIDTH = 30;
  let failures = 0;

  for (const r of checks) {
    const icon = r.passed ? "✅" : "❌";
    const label = r.name.padEnd(WIDTH);
    const status = r.status !== null ? `[${r.status}]` : "[---]";
    console.log(`${icon}  ${label} ${status.padEnd(6)}  ${r.detail}`);
    if (!r.passed) failures++;
  }

  console.log();

  if (failures === 0) {
    console.log(`✅  All ${checks.length} checks passed — site is healthy.`);
    process.exit(0);
  } else {
    console.error(
      `❌  ${failures} of ${checks.length} check(s) FAILED — investigate before announcing the release.`,
    );
    process.exit(1);
  }
}

main();
