import { auth } from "@/auth";
import { Octokit } from "@octokit/rest";
import { NextRequest, NextResponse } from "next/server";
import {
  getLatestTriageForIssues,
  getWorkflowsForIssues,
  TriageSession,
  IssueWorkflow,
  WorkflowStatus,
} from "@/lib/supabase";

interface TriageInfo {
  status: "pending" | "in_progress" | "completed" | "failed";
  sessionUrl: string | null;
  sessionId: string | null;
  confidence?: "low" | "medium" | "high";
  structuredOutput?: TriageSession["structured_output"];
}

interface WorkflowInfo {
  workflowStatus: WorkflowStatus;
  triageSessionId: string | null;
  triageSessionUrl: string | null;
  prSessionId: string | null;
  prSessionUrl: string | null;
  prUrl: string | null;
}

function mapTriageSessionToInfo(session: TriageSession): TriageInfo {
  return {
    status: session.status,
    sessionUrl: session.session_url,
    sessionId: session.session_id,
    confidence: session.structured_output?.confidence_score,
    structuredOutput: session.structured_output,
  };
}

function mapWorkflowToInfo(workflow: IssueWorkflow): WorkflowInfo {
  return {
    workflowStatus: workflow.workflow_status,
    triageSessionId: workflow.triage_session_id || null,
    triageSessionUrl: workflow.triage_session_url || null,
    prSessionId: workflow.pr_session_id || null,
    prSessionUrl: workflow.pr_session_url || null,
    prUrl: workflow.pr_url || null,
  };
}

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");

  if (!owner || !repo) {
    return NextResponse.json(
      { error: "Missing owner or repo parameter" },
      { status: 400 }
    );
  }

  try {
    const octokit = new Octokit({
      auth: session.accessToken,
    });

    const { data: issues } = await octokit.issues.listForRepo({
      owner,
      repo,
      state: "open",
      per_page: 100,
    });

    const filteredIssues = issues.filter((issue) => !issue.pull_request);

    const issueNumbers = filteredIssues.map((issue) => issue.number);
    const [triageSessions, workflows] = await Promise.all([
      getLatestTriageForIssues(owner, repo, issueNumbers),
      getWorkflowsForIssues(owner, repo, issueNumbers),
    ]);

    const issuesWithTriage = filteredIssues.map((issue) => {
      const triageSession = triageSessions.get(issue.number);
      const workflow = workflows.get(issue.number);
      const triageInfo = triageSession ? mapTriageSessionToInfo(triageSession) : null;
      const workflowInfo = workflow ? mapWorkflowToInfo(workflow) : null;

      return {
        id: issue.id,
        number: issue.number,
        title: issue.title,
        state: issue.state,
        labels: issue.labels.map((label) =>
          typeof label === "string"
            ? { name: label, color: "gray" }
            : { name: label.name, color: label.color }
        ),
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        user: issue.user
          ? {
              login: issue.user.login,
              avatar_url: issue.user.avatar_url,
            }
          : null,
        html_url: issue.html_url,
        body: issue.body,
        triage: triageInfo,
        workflow: workflowInfo,
      };
    });

    return NextResponse.json(issuesWithTriage);
  } catch (error) {
    console.error("Error fetching issues:", error);
    return NextResponse.json(
      { error: "Failed to fetch issues" },
      { status: 500 }
    );
  }
}
