import { auth } from "@/auth";
import { Octokit } from "@octokit/rest";
import { NextRequest, NextResponse } from "next/server";
import { getLatestTriageForIssues, TriageSession } from "@/lib/supabase";

interface TriageInfo {
  status: "pending" | "in_progress" | "completed" | "failed";
  sessionUrl: string | null;
  sessionId: string | null;
  confidence?: "low" | "medium" | "high";
  structuredOutput?: TriageSession["structured_output"];
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
    const triageSessions = await getLatestTriageForIssues(owner, repo, issueNumbers);

    const issuesWithTriage = filteredIssues.map((issue) => {
      const triageSession = triageSessions.get(issue.number);
      const triageInfo = triageSession ? mapTriageSessionToInfo(triageSession) : null;

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
