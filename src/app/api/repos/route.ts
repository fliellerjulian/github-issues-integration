import { auth } from "@/auth";
import { Octokit } from "@octokit/rest";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const octokit = new Octokit({
      auth: session.accessToken,
    });

    const { data: repos } = await octokit.repos.listForAuthenticatedUser({
      sort: "updated",
      per_page: 100,
    });

    const simplifiedRepos = repos.map((repo) => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      owner: repo.owner.login,
      private: repo.private,
      open_issues_count: repo.open_issues_count,
      updated_at: repo.updated_at,
    }));

    return NextResponse.json(simplifiedRepos);
  } catch (error) {
    console.error("Error fetching repos:", error);
    return NextResponse.json(
      { error: "Failed to fetch repositories" },
      { status: 500 }
    );
  }
}
