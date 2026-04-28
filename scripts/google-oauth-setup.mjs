#!/usr/bin/env node
/**
 * Google OAuth re-authorization script
 * Generates a new GOOGLE_REFRESH_TOKEN with all required scopes:
 *   - webmasters.readonly (Google Search Console)
 *   - analytics.readonly  (Google Analytics 4)  ← NEW
 *   - spreadsheets        (Google Sheets)
 *
 * Usage:
 *   GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=yyy node scripts/google-oauth-setup.mjs
 *
 * Or set them at the prompt when asked.
 */

import http from "http";
import { exec } from "child_process";
import readline from "readline";

const SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/spreadsheets",
];

const REDIRECT_URI = "http://localhost:8787/oauth/callback";

async function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans.trim()); }));
}

async function main() {
  let clientId = process.env.GOOGLE_CLIENT_ID;
  let clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId) {
    console.log("\n── Google OAuth Setup ──────────────────────────────────────────\n");
    console.log("You need GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from:");
    console.log("  Vercel dashboard → seo-dashboard project → Settings → Environment Variables\n");
    clientId = await prompt("Paste GOOGLE_CLIENT_ID: ");
  }
  if (!clientSecret) {
    clientSecret = await prompt("Paste GOOGLE_CLIENT_SECRET: ");
  }

  if (!clientId || !clientSecret) {
    console.error("Error: both CLIENT_ID and CLIENT_SECRET are required.");
    process.exit(1);
  }

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPES.join(" "));
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent"); // force refresh_token re-issue

  console.log("\n────────────────────────────────────────────────────────────────");
  console.log("Opening Google authorization page in your browser...");
  console.log("(If it doesn't open, paste this URL manually)\n");
  console.log(authUrl.toString());
  console.log("────────────────────────────────────────────────────────────────\n");

  // Try to open browser
  exec(`open "${authUrl.toString()}"`, () => {});

  // Start local callback server
  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, "http://localhost:8787");
      if (url.pathname !== "/oauth/callback") return;

      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      res.writeHead(200, { "Content-Type": "text/html" });
      if (code) {
        res.end("<h2>✓ Authorization complete — return to your terminal.</h2>");
        server.close();
        resolve(code);
      } else {
        res.end(`<h2>Error: ${error}</h2>`);
        server.close();
        reject(new Error(`OAuth error: ${error}`));
      }
    });

    server.listen(8787, "localhost", () => {
      console.log("Waiting for Google to redirect back... (listening on port 8787)\n");
    });

    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error("Port 8787 is already in use. Kill the process using it and try again.");
      }
      reject(err);
    });
  });

  console.log("Authorization code received. Exchanging for tokens...\n");

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  const tokens = await tokenRes.json();

  if (!tokenRes.ok || !tokens.refresh_token) {
    console.error("Token exchange failed:", JSON.stringify(tokens, null, 2));
    process.exit(1);
  }

  const refreshToken = tokens.refresh_token;

  console.log("════════════════════════════════════════════════════════════════");
  console.log("✓ New GOOGLE_REFRESH_TOKEN obtained\n");
  console.log("Scopes authorized:");
  SCOPES.forEach((s) => console.log("  ✓ " + s));
  console.log("\n────────────────────────────────────────────────────────────────");
  console.log("GOOGLE_REFRESH_TOKEN =", refreshToken);
  console.log("────────────────────────────────────────────────────────────────\n");

  console.log("Run these commands to update Vercel and Fly.io:\n");

  // Vercel update (needs vercel CLI or dashboard)
  console.log("── Vercel (run in terminal) ──");
  console.log(`vercel env rm GOOGLE_REFRESH_TOKEN production --yes 2>/dev/null; echo "${refreshToken}" | vercel env add GOOGLE_REFRESH_TOKEN production`);
  console.log();

  // Fly.io update
  console.log("── Fly.io (run in terminal) ──");
  console.log(`FLY_ACCESS_TOKEN="$(cat ~/.fly/config.yml | grep access_token | cut -d' ' -f2)" ~/.fly/bin/fly secrets set GOOGLE_REFRESH_TOKEN="${refreshToken}" --app seo-worker-winter-tree-4075`);
  console.log();
  console.log("Or just paste the token below and this script will update Fly.io for you.");

  const doFly = await prompt("\nUpdate Fly.io now? (y/n): ");
  if (doFly.toLowerCase() === "y") {
    const flyToken = process.env.FLY_API_TOKEN || await prompt("Paste FLY_API_TOKEN: ");

    const flyRes = await fetch("https://api.machines.dev/v1/apps/seo-worker-winter-tree-4075/secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${flyToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        secrets: [{ name: "GOOGLE_REFRESH_TOKEN", value: refreshToken }],
      }),
    });

    if (flyRes.ok) {
      console.log("✓ Fly.io secret updated.");
    } else {
      const err = await flyRes.text();
      console.log("Fly.io update failed (update manually):", err);
    }
  }

  console.log("\n✓ Done. Update GOOGLE_REFRESH_TOKEN in Vercel manually if you didn't run the vercel CLI command above.");
  console.log("  Vercel → seo-dashboard project → Settings → Environment Variables → GOOGLE_REFRESH_TOKEN → Edit\n");
}

main().catch((e) => { console.error(e.message); process.exit(1); });
