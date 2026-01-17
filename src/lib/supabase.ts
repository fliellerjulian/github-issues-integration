import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_PROJECT_URL!;
const supabaseKey = process.env.SUPABASE_API_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface TriageSession {
  id?: string;
  repo_owner: string;
  repo_name: string;
  issue_number: number;
  session_id: string;
  session_url: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  structured_output?: TriageResult | null;
  created_at?: string;
  updated_at?: string;
}

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

export async function createTriageSession(
  session: Omit<TriageSession, "id" | "created_at" | "updated_at">
): Promise<TriageSession | null> {
  const { data, error } = await supabase
    .from("triage_sessions")
    .insert(session)
    .select()
    .single();

  if (error) {
    console.error("Error creating triage session:", error);
    return null;
  }

  return data;
}

export async function updateTriageSession(
  sessionId: string,
  updates: Partial<TriageSession>
): Promise<TriageSession | null> {
  const { data, error } = await supabase
    .from("triage_sessions")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("session_id", sessionId)
    .select()
    .single();

  if (error) {
    console.error("Error updating triage session:", error);
    return null;
  }

  return data;
}

export async function getTriageSession(
  repoOwner: string,
  repoName: string,
  issueNumber: number
): Promise<TriageSession | null> {
  const { data, error } = await supabase
    .from("triage_sessions")
    .select()
    .eq("repo_owner", repoOwner)
    .eq("repo_name", repoName)
    .eq("issue_number", issueNumber)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    console.error("Error getting triage session:", error);
    return null;
  }

  return data;
}

export async function getTriageSessionsByRepo(
  repoOwner: string,
  repoName: string
): Promise<TriageSession[]> {
  const { data, error } = await supabase
    .from("triage_sessions")
    .select()
    .eq("repo_owner", repoOwner)
    .eq("repo_name", repoName)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error getting triage sessions:", error);
    return [];
  }

  return data || [];
}

export async function getLatestTriageForIssues(
  repoOwner: string,
  repoName: string,
  issueNumbers: number[]
): Promise<Map<number, TriageSession>> {
  if (issueNumbers.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("triage_sessions")
    .select()
    .eq("repo_owner", repoOwner)
    .eq("repo_name", repoName)
    .in("issue_number", issueNumbers)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error getting triage sessions:", error);
    return new Map();
  }

  const result = new Map<number, TriageSession>();
  for (const session of data || []) {
    if (!result.has(session.issue_number)) {
      result.set(session.issue_number, session);
    }
  }

  return result;
}
