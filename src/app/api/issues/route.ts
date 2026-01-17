import { auth } from "@/auth";
import { Octokit } from "@octokit/rest";
import { NextRequest, NextResponse } from "next/server";

interface TriageInfo {
  status: "in_progress" | "completed";
  sessionUrl: string | null;
  confidence?: "low" | "medium" | "high";
}

function parseTriageComment(body: string): TriageInfo | null {
  if (!body.includes("Devin Triage")) {
    return null;
  }

  const sessionUrlMatch = body.match(/\[View Devin Session\]\((https:\/\/app\.devin\.ai\/sessions\/[^)]+)\)/);
  const sessionUrl = sessionUrlMatch ? sessionUrlMatch[1] : null;

  if (body.includes("Triage In Progress")) {
    return { status: "in_progress", sessionUrl };
  }

  if (body.includes("Triage Assessment")) {
    let confidence: "low" | "medium" | "high" | undefined;
    if (body.includes("🟢") && body.includes("high")) {
      confidence = "high";
    } else if (body.includes("🟡") && body.includes("medium")) {
      confidence = "medium";
    } else if (body.includes("🔴") && body.includes("low")) {
      confidence = "low";
    }
    return { status: "completed", sessionUrl, confidence };
  }

  return { status: "in_progress", sessionUrl };
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

    const issuesWithTriage = await Promise.all(
      filteredIssues.map(async (issue) => {
        let triageInfo: TriageInfo | null = null;

        try {
          const { data: comments } = await octokit.issues.listComments({
            owner,
            repo,
            issue_number: issue.number,
            per_page: 50,
          });

          for (const comment of comments.reverse()) {
            if (comment.body) {
              const parsed = parseTriageComment(comment.body);
              if (parsed) {
                triageInfo = parsed;
                break;
              }
            }
          }
        } catch (err) {
          console.error(`Error fetching comments for issue #${issue.number}:`, err);
        }

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
      })
    );

    return NextResponse.json(issuesWithTriage);
  } catch (error) {
    console.error("Error fetching issues:", error);
    return NextResponse.json(
      { error: "Failed to fetch issues" },
      { status: 500 }
    );
  }
}
