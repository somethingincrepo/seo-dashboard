import { NextRequest, NextResponse } from "next/server";
import { getClientByToken } from "@/lib/clients";
import { updateContentApproval } from "@/lib/content";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { resultId, decision, notes, token } = body;

    if (!resultId || !decision || !token) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const validDecisions = ["approved", "needs_revision"];
    if (!validDecisions.includes(decision)) {
      return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
    }

    const client = await getClientByToken(token);
    if (!client) {
      return NextResponse.json({ error: "Invalid token" }, { status: 403 });
    }

    await updateContentApproval(resultId, decision, notes);

    // Slack alert
    const slackUrl = process.env.SLACK_WEBHOOK_URL;
    if (slackUrl) {
      const companyName = client.fields.company_name || "Unknown client";
      const articleTitle = body.blogTitle || "article";
      let text: string;
      if (decision === "approved") {
        text = `✅ *${companyName}* approved article for publishing: *${articleTitle}*\nReady to publish — trigger content agent in publish mode.`;
      } else {
        text = `📝 *${companyName}* requested revision on: *${articleTitle}*\n\n${notes || "(no notes provided)"}`;
      }
      await fetch(slackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      }).catch(() => {
        // Non-fatal: don't fail the request if Slack is down
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Content approval failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
