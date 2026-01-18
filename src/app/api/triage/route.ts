import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import {
  createTriageSession as createDevinSession,
  getSessionDetails,
  createPRSession,
} from "@/lib/devin";
import {
  createTriageSession,
  updateTriageSession,
  upsertIssueWorkflow,
  getTriageSession,
} from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { issue, repository } = body;

    if (!issue || !repository) {
      return NextResponse.json(
        { error: "Missing issue or repository data" },
        { status: 400 }
      );
    }

    const devinSession = await createDevinSession(issue, repository);

    await createTriageSession({
      repo_owner: repository.owner,
      repo_name: repository.name,
      issue_number: issue.number,
      session_id: devinSession.session_id,
      session_url: devinSession.url,
      status: "in_progress",
    });

    return NextResponse.json({
      session_id: devinSession.session_id,
      session_url: devinSession.url,
      message: "Triage session created",
    });
  } catch (error) {
    console.error("Error creating triage session:", error);
    return NextResponse.json(
      { error: "Failed to create triage session" },
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
  const issueNumberStr = searchParams.get("issue_number");
  const issueData = searchParams.get("issue_data");

  if (!sessionId) {
    return NextResponse.json(
      { error: "Missing session_id parameter" },
      { status: 400 }
    );
  }

  try {
    const sessionDetails = await getSessionDetails(sessionId);

    const hasTriageResult = !!sessionDetails.structured_output;
    const isSessionEnded =
      sessionDetails.status === "stopped" ||
      sessionDetails.status === "blocked" ||
      sessionDetails.status === "error";

    let prSessionStarted = false;
    let prSessionId: string | null = null;
    let prSessionUrl: string | null = null;

    if (hasTriageResult) {
      await updateTriageSession(sessionId, {
        status: "completed",
        structured_output: sessionDetails.structured_output,
      });

      const triageResult = sessionDetails.structured_output!;
      const shouldAutoStartPR =
        triageResult.confidence_score === "high" &&
        !triageResult.requires_human_input;

      if (owner && repo && issueNumberStr) {
        const issueNumber = parseInt(issueNumberStr, 10);

        if (shouldAutoStartPR && issueData) {
          try {
            const issue = JSON.parse(issueData);
            const prSession = await createPRSession(
              issue,
              { full_name: `${owner}/${repo}` },
              triageResult
            );

            prSessionStarted = true;
            prSessionId = prSession.session_id;
            prSessionUrl = prSession.url;

            await upsertIssueWorkflow({
              repo_owner: owner,
              repo_name: repo,
              issue_number: issueNumber,
              workflow_status: "processing",
              triage_session_id: sessionId,
              triage_session_url: sessionDetails.title ? `https://app.devin.ai/sessions/${sessionId}` : null,
              pr_session_id: prSession.session_id,
              pr_session_url: prSession.url,
            });
          } catch (prError) {
            console.error("Error auto-starting PR session:", prError);
            await upsertIssueWorkflow({
              repo_owner: owner,
              repo_name: repo,
              issue_number: issueNumber,
              workflow_status: "triaged",
              triage_session_id: sessionId,
            });
          }
        } else {
          await upsertIssueWorkflow({
            repo_owner: owner,
            repo_name: repo,
            issue_number: issueNumber,
            workflow_status: "triaged",
            triage_session_id: sessionId,
          });
        }
      }
    } else if (sessionDetails.status === "error") {
      await updateTriageSession(sessionId, {
        status: "failed",
      });

      if (owner && repo && issueNumberStr) {
        await upsertIssueWorkflow({
          repo_owner: owner,
          repo_name: repo,
          issue_number: parseInt(issueNumberStr, 10),
          workflow_status: "failed",
          triage_session_id: sessionId,
        });
      }
    }

    return NextResponse.json({
      session_id: sessionDetails.session_id,
      status: sessionDetails.status,
      triage_result: sessionDetails.structured_output || null,
      is_complete: hasTriageResult || isSessionEnded,
      pr_session_started: prSessionStarted,
      pr_session_id: prSessionId,
      pr_session_url: prSessionUrl,
    });
  } catch (error) {
    console.error("Error fetching session details:", error);
    
    try {
      await updateTriageSession(sessionId, {
        status: "failed",
      });
    } catch (updateError) {
      console.error("Error updating session to failed:", updateError);
    }
    
    return NextResponse.json(
      { error: "Failed to fetch session details", is_complete: true },
      { status: 500 }
    );
  }
}
