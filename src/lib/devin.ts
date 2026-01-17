const DEVIN_API_BASE = "https://api.devin.ai/v1";

export interface TriageResult {
  scope: string;
  complexity: "low" | "medium" | "high";
  estimated_effort: string;
  confidence_score: "low" | "medium" | "high";
  confidence_reasoning: string;
  suggested_approach: string;
  blockers: string[];
  requires_human_input: boolean;
}

export interface DevinSession {
  session_id: string;
  url: string;
  is_new_session: boolean;
}

export interface DevinSessionDetails {
  session_id: string;
  status: string;
  title: string;
  created_at: string;
  updated_at: string;
  structured_output?: TriageResult;
}

const TRIAGE_PROMPT_TEMPLATE = `Triage this GitHub issue and assess if you can work on it autonomously.

## Issue
**Repo:** {repo_full_name} | **Issue #:** {issue_number}
**Title:** {issue_title}
**Labels:** {issue_labels}
**Author:** {issue_author} | **Created:** {issue_created_at}

**Description:**
{issue_body}

## Instructions
This is a TRIAGE-ONLY task - do NOT implement anything. Analyze the issue and update the structured output IMMEDIATELY with your assessment. Complete this in under 1 minute.

Consider:
- Are requirements clear and well-defined?
- Is this a standard coding task you can handle autonomously?
- Are there external dependencies or credentials needed?
- What's the complexity and effort estimate?

Update structured output with this JSON format:
{
  "scope": "Brief description of what needs to be done",
  "complexity": "low" | "medium" | "high",
  "estimated_effort": "1-2 hours" | "2-4 hours" | "4-8 hours" | "8+ hours",
  "confidence_score": "low" | "medium" | "high",
  "confidence_reasoning": "Why you can or cannot handle this",
  "suggested_approach": "How you would solve this",
  "blockers": ["Potential blockers or missing info"],
  "requires_human_input": true | false
}

Confidence: HIGH = clear requirements, standard task, no external deps | MEDIUM = mostly clear, moderate complexity | LOW = vague, needs external access, complex architecture

Update structured output now and complete the task.`;

export async function createTriageSession(
  issue: {
    number: number;
    title: string;
    body: string | null;
    labels: Array<{ name: string }>;
    user: { login: string } | null;
    created_at: string;
  },
  repo: {
    full_name: string;
  }
): Promise<DevinSession> {
  const apiKey = process.env.DEVIN_API_KEY;
  if (!apiKey) {
    throw new Error("DEVIN_API_KEY is not configured");
  }

  const prompt = TRIAGE_PROMPT_TEMPLATE
    .replace("{repo_full_name}", repo.full_name)
    .replace("{issue_number}", String(issue.number))
    .replace("{issue_title}", issue.title)
    .replace("{issue_labels}", issue.labels.map((l) => l.name).join(", ") || "None")
    .replace("{issue_author}", issue.user?.login || "Unknown")
    .replace("{issue_created_at}", issue.created_at)
    .replace("{issue_body}", issue.body || "No description provided");

  const response = await fetch(`${DEVIN_API_BASE}/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      title: `Triage: ${repo.full_name}#${issue.number} - ${issue.title}`,
      tags: ["triage", repo.full_name, `issue-${issue.number}`],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create Devin session: ${error}`);
  }

  return response.json();
}

export async function getSessionDetails(
  sessionId: string
): Promise<DevinSessionDetails> {
  const apiKey = process.env.DEVIN_API_KEY;
  if (!apiKey) {
    throw new Error("DEVIN_API_KEY is not configured");
  }

  const response = await fetch(`${DEVIN_API_BASE}/sessions/${sessionId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get session details: ${error}`);
  }

  return response.json();
}

export async function postTriageResultToGitHub(
  owner: string,
  repo: string,
  issueNumber: number,
  sessionUrl: string,
  triageResult: TriageResult | null,
  accessToken: string
): Promise<void> {
  const confidenceEmoji = {
    low: "🔴",
    medium: "🟡",
    high: "🟢",
  };

  const complexityEmoji = {
    low: "🟢",
    medium: "🟡",
    high: "🔴",
  };

  let commentBody: string;

  if (triageResult) {
    commentBody = `## 🤖 Devin Triage Assessment

### Summary
${triageResult.scope}

### Assessment
| Metric | Value |
|--------|-------|
| **Complexity** | ${complexityEmoji[triageResult.complexity]} ${triageResult.complexity} |
| **Estimated Effort** | ${triageResult.estimated_effort} |
| **Devin Confidence** | ${confidenceEmoji[triageResult.confidence_score]} ${triageResult.confidence_score} |
| **Requires Human Input** | ${triageResult.requires_human_input ? "Yes" : "No"} |

### Confidence Reasoning
${triageResult.confidence_reasoning}

### Suggested Approach
${triageResult.suggested_approach}

${triageResult.blockers.length > 0 ? `### Potential Blockers\n${triageResult.blockers.map((b) => `- ${b}`).join("\n")}` : ""}

---
[View Devin Session](${sessionUrl})`;
  } else {
    commentBody = `## 🤖 Devin Triage In Progress

Devin is analyzing this issue. Results will be posted here once complete.

[View Devin Session](${sessionUrl})`;
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github.v3+json",
      },
      body: JSON.stringify({ body: commentBody }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to post comment to GitHub: ${error}`);
  }
}
