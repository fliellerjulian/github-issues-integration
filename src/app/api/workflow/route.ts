import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import {
  createPRSession,
  getSessionDetails,
  TriageResult,
} from "@/lib/devin";
import {
  getIssueWorkflow,
  updateIssueWorkflow,
  upsertIssueWorkflow,
  getLatestTriageForIssues,
} from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { issue, repository, triageResult } = body;

    if (!issue || !repository || !triageResult) {
      return NextResponse.json(
        { error: "Missing issue, repository, or triageResult data" },
        { status: 400 }
      );
    }

    const prSession = await createPRSession(
      issue,
      repository,
      triageResult as TriageResult
    );

    await upsertIssueWorkflow({
      repo_owner: repository.owner,
      repo_name: repository.name,
      issue_number: issue.number,
      workflow_status: "processing",
      pr_session_id: prSession.session_id,
      pr_session_url: prSession.url,
    });

    return NextResponse.json({
      session_id: prSession.session_id,
      session_url: prSession.url,
      message: "PR session created",
    });
  } catch (error) {
    console.error("Error creating PR session:", error);
    return NextResponse.json(
      { error: "Failed to create PR session" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const sessionId = searchParams.get("session_id");
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");
  const issueNumber = searchParams.get("issue_number");

  if (!sessionId) {
    return NextResponse.json(
      { error: "Missing session_id parameter" },
      { status: 400 }
    );
  }

  try {
    const sessionDetails = await getSessionDetails(sessionId);

    const hasPR = !!sessionDetails.pull_request?.url;
    const isBlocked = sessionDetails.status === "blocked";
    const isSessionEnded =
      sessionDetails.status === "stopped" ||
      sessionDetails.status === "error";

    let workflowStatus: "processing" | "awaiting_instructions" | "pr" | "failed" = "processing";
    let prUrl: string | null = null;

    if (hasPR) {
      workflowStatus = "pr";
      prUrl = sessionDetails.pull_request!.url;
    } else if (isBlocked) {
      workflowStatus = "awaiting_instructions";
    } else if (isSessionEnded) {
      workflowStatus = "failed";
    }

    if (owner && repo && issueNumber) {
      await updateIssueWorkflow(owner, repo, parseInt(issueNumber, 10), {
        workflow_status: workflowStatus,
        pr_url: prUrl,
      });
    }

    return NextResponse.json({
      session_id: sessionDetails.session_id,
      status: sessionDetails.status,
      workflow_status: workflowStatus,
      pr_url: prUrl,
      is_complete: hasPR || isSessionEnded,
    });
  } catch (error) {
    console.error("Error fetching PR session details:", error);

    if (owner && repo && issueNumber) {
      try {
        await updateIssueWorkflow(owner, repo, parseInt(issueNumber, 10), {
          workflow_status: "failed",
        });
      } catch (updateError) {
        console.error("Error updating workflow to failed:", updateError);
      }
    }

    return NextResponse.json(
      { error: "Failed to fetch session details", is_complete: true },
      { status: 500 }
    );
  }
}
