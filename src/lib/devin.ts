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

const TRIAGE_PROMPT_TEMPLATE = `You are analyzing a GitHub issue to determine if Devin (an AI software engineer) can work on it.

## Issue Details
**Repository:** {repo_full_name}
**Issue #:** {issue_number}
**Title:** {issue_title}
**Labels:** {issue_labels}
**Created by:** {issue_author}
**Created at:** {issue_created_at}

**Description:**
{issue_body}

## Your Task
Analyze this issue and provide a triage assessment. Consider:
1. Is the issue well-defined with clear requirements?
2. Does it require access to external systems or credentials?
3. Is it a coding task that Devin can handle autonomously?
4. What is the complexity and estimated effort?

Please update the structured output immediately with your assessment in this exact JSON format:
{
  "scope": "Brief description of what needs to be done",
  "complexity": "low" | "medium" | "high",
  "estimated_effort": "1-2 hours" | "2-4 hours" | "4-8 hours" | "8+ hours",
  "confidence_score": "low" | "medium" | "high",
  "confidence_reasoning": "Explanation of why Devin can or cannot handle this issue",
  "suggested_approach": "How Devin would approach solving this issue",
  "blockers": ["List of potential blockers or missing information"],
  "requires_human_input": true | false
}

Confidence Score Guidelines:
- HIGH: Clear requirements, standard coding task, no external dependencies
- MEDIUM: Mostly clear but may need some clarification, moderate complexity
- LOW: Vague requirements, needs external access, or highly complex architecture decisions`;

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
