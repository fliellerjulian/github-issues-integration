import crypto from "crypto";

export function verifyGitHubWebhook(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) {
    return false;
  }

  const expectedSignature = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex")}`;

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export interface GitHubIssueWebhookPayload {
  action: string;
  issue: {
    id: number;
    number: number;
    title: string;
    body: string | null;
    state: string;
    html_url: string;
    user: {
      login: string;
      avatar_url: string;
    } | null;
    labels: Array<{
      name: string;
      color: string;
    }>;
    created_at: string;
    updated_at: string;
  };
  repository: {
    id: number;
    name: string;
    full_name: string;
    owner: {
      login: string;
    };
    html_url: string;
  };
  sender: {
    login: string;
  };
}

export interface GitHubIssueCommentWebhookPayload {
  action: string;
  issue: GitHubIssueWebhookPayload["issue"];
  comment: {
    id: number;
    body: string;
    user: {
      login: string;
    };
    created_at: string;
  };
  repository: GitHubIssueWebhookPayload["repository"];
  sender: {
    login: string;
  };
}
