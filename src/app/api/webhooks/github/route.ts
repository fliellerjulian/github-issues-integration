import { NextRequest, NextResponse } from "next/server";
import {
  verifyGitHubWebhook,
  GitHubIssueWebhookPayload,
  GitHubIssueCommentWebhookPayload,
} from "@/lib/github-webhook";
import { createTriageSession, postTriageResultToGitHub } from "@/lib/devin";
import { upsertIssueWorkflow } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    console.error("GITHUB_WEBHOOK_SECRET is not configured");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  const signature = request.headers.get("x-hub-signature-256");
  const event = request.headers.get("x-github-event");
  const payload = await request.text();

  if (!verifyGitHubWebhook(payload, signature, webhookSecret)) {
    console.error("Invalid webhook signature");
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 401 }
    );
  }

  const data = JSON.parse(payload);

  try {
    if (event === "issues") {
      return handleIssueEvent(data as GitHubIssueWebhookPayload);
    } else if (event === "issue_comment") {
      return handleIssueCommentEvent(data as GitHubIssueCommentWebhookPayload);
    }

    return NextResponse.json({ message: "Event ignored" }, { status: 200 });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 }
    );
  }
}

async function handleIssueEvent(payload: GitHubIssueWebhookPayload) {
  const { action, issue, repository } = payload;

  if (action !== "opened" && action !== "edited") {
    return NextResponse.json(
      { message: `Issue action '${action}' ignored` },
      { status: 200 }
    );
  }

  console.log(
    `Processing issue ${action}: ${repository.full_name}#${issue.number}`
  );

  try {
    const session = await createTriageSession(issue, repository);

    console.log(`Created Devin session: ${session.session_id}`);

    try {
      await upsertIssueWorkflow({
        repo_owner: repository.owner.login,
        repo_name: repository.name,
        issue_number: issue.number,
        workflow_status: "new",
        triage_session_id: session.session_id,
        triage_session_url: session.url,
      });
    } catch (workflowError) {
      console.error("Error updating workflow (non-blocking):", workflowError);
    }

    const githubToken = process.env.GITHUB_ACCESS_TOKEN;
    if (githubToken) {
      await postTriageResultToGitHub(
        repository.owner.login,
        repository.name,
        issue.number,
        session.url,
        null,
        githubToken
      );
    }

    return NextResponse.json({
      message: "Triage session created",
      session_id: session.session_id,
      session_url: session.url,
    });
  } catch (error) {
    console.error("Error creating triage session:", error);
    return NextResponse.json(
      { error: "Failed to create triage session" },
      { status: 500 }
    );
  }
}

async function handleIssueCommentEvent(
  payload: GitHubIssueCommentWebhookPayload
) {
  const { action, issue, comment, repository } = payload;

  if (action !== "created") {
    return NextResponse.json(
      { message: `Comment action '${action}' ignored` },
      { status: 200 }
    );
  }

  if (comment.body.toLowerCase().includes("@devin retriage") ||
      comment.body.toLowerCase().includes("/retriage")) {
    console.log(
      `Re-triage requested for: ${repository.full_name}#${issue.number}`
    );

    try {
      const session = await createTriageSession(issue, repository);

      console.log(`Created Devin re-triage session: ${session.session_id}`);

      const githubToken = process.env.GITHUB_ACCESS_TOKEN;
      if (githubToken) {
        await postTriageResultToGitHub(
          repository.owner.login,
          repository.name,
          issue.number,
          session.url,
          null,
          githubToken
        );
      }

      return NextResponse.json({
        message: "Re-triage session created",
        session_id: session.session_id,
        session_url: session.url,
      });
    } catch (error) {
      console.error("Error creating re-triage session:", error);
      return NextResponse.json(
        { error: "Failed to create re-triage session" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    { message: "Comment does not trigger re-triage" },
    { status: 200 }
  );
}
