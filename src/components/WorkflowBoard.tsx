"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";

interface Label {
  name: string | undefined;
  color: string | undefined;
}

interface TriageResult {
  scope: string;
  complexity: "low" | "medium" | "high";
  estimated_effort: string;
  confidence_score: "low" | "medium" | "high";
  confidence_reasoning: string;
  suggested_approach: string;
  blockers: string[];
  requires_human_input: boolean;
}

interface TriageInfo {
  status: "pending" | "in_progress" | "completed" | "failed";
  sessionUrl: string | null;
  sessionId: string | null;
  confidence?: "low" | "medium" | "high";
  structuredOutput?: TriageResult | null;
}

type WorkflowStatus =
  | "new"
  | "triaged"
  | "processing"
  | "awaiting_instructions"
  | "pr"
  | "failed";

interface WorkflowInfo {
  workflowStatus: WorkflowStatus;
  triageSessionId: string | null;
  triageSessionUrl: string | null;
  prSessionId: string | null;
  prSessionUrl: string | null;
  prUrl: string | null;
}

interface Issue {
  id: number;
  number: number;
  title: string;
  state: string;
  labels: Label[];
  created_at: string;
  updated_at: string;
  user: {
    login: string;
    avatar_url: string;
  } | null;
  html_url: string;
  body: string | null;
  triage: TriageInfo | null;
  workflow: WorkflowInfo | null;
}

interface WorkflowBoardProps {
  owner: string;
  repo: string;
}

const WORKFLOW_COLUMNS: { status: WorkflowStatus; label: string; color: string; bgColor: string }[] = [
  { status: "new", label: "New", color: "text-blue-700", bgColor: "bg-blue-50" },
  { status: "triaged", label: "Triaged", color: "text-purple-700", bgColor: "bg-purple-50" },
  { status: "processing", label: "Processing", color: "text-yellow-700", bgColor: "bg-yellow-50" },
  { status: "awaiting_instructions", label: "Awaiting Instructions", color: "text-orange-700", bgColor: "bg-orange-50" },
  { status: "pr", label: "PR", color: "text-green-700", bgColor: "bg-green-50" },
  { status: "failed", label: "Failed", color: "text-red-700", bgColor: "bg-red-50" },
];

export function WorkflowBoard({ owner, repo }: WorkflowBoardProps) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIssue, setExpandedIssue] = useState<number | null>(null);
  const [triagingIssues, setTriagingIssues] = useState<Set<number>>(new Set());
  const [startingPRIssues, setStartingPRIssues] = useState<Set<number>>(new Set());
  const [pollingTriageIds, setPollingTriageIds] = useState<Map<number, string>>(new Map());
  const [pollingPRIds, setPollingPRIds] = useState<Map<number, string>>(new Map());
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchIssues = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/issues?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch issues");
      }
      const data = await response.json();
      setIssues(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  }, [owner, repo]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchIssues().finally(() => setLoading(false));
  }, [fetchIssues]);

  const pollTriageStatus = useCallback(async (issueNumber: number, sessionId: string, issue: Issue) => {
    try {
      const issueData = encodeURIComponent(JSON.stringify({
        number: issue.number,
        title: issue.title,
        body: issue.body,
        labels: issue.labels,
        user: issue.user,
        created_at: issue.created_at,
      }));
      const response = await fetch(
        `/api/triage?session_id=${encodeURIComponent(sessionId)}&owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&issue_number=${issueNumber}&issue_data=${issueData}`
      );
      if (!response.ok) return null;
      return await response.json();
    } catch (err) {
      console.error("Error polling triage status:", err);
      return null;
    }
  }, [owner, repo]);

  const pollPRStatus = useCallback(async (issueNumber: number, sessionId: string) => {
    try {
      const response = await fetch(
        `/api/workflow?session_id=${encodeURIComponent(sessionId)}&owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&issue_number=${issueNumber}`
      );
      if (!response.ok) return null;
      return await response.json();
    } catch (err) {
      console.error("Error polling PR status:", err);
      return null;
    }
  }, [owner, repo]);

  useEffect(() => {
    const hasPollingItems = pollingTriageIds.size > 0 || pollingPRIds.size > 0;

    if (!hasPollingItems) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    if (pollingIntervalRef.current) return;

    pollingIntervalRef.current = setInterval(async () => {
      let shouldRefetch = false;

      for (const [issueNumber, sessionId] of pollingTriageIds) {
        const issue = issues.find(i => i.number === issueNumber);
        if (!issue) continue;

        const data = await pollTriageStatus(issueNumber, sessionId, issue);
        if (data?.is_complete) {
          setPollingTriageIds(prev => {
            const next = new Map(prev);
            next.delete(issueNumber);
            return next;
          });

          if (data.pr_session_started && data.pr_session_id) {
            setPollingPRIds(prev => new Map(prev).set(issueNumber, data.pr_session_id));
          }

          shouldRefetch = true;
        }
      }

      for (const [issueNumber, sessionId] of pollingPRIds) {
        const data = await pollPRStatus(issueNumber, sessionId);
        if (data?.is_complete) {
          setPollingPRIds(prev => {
            const next = new Map(prev);
            next.delete(issueNumber);
            return next;
          });
          shouldRefetch = true;
        }
      }

      if (shouldRefetch) {
        await fetchIssues();
      }
    }, 5000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [pollingTriageIds, pollingPRIds, pollTriageStatus, pollPRStatus, fetchIssues, issues]);

  const handleTriage = async (issue: Issue) => {
    setTriagingIssues(prev => new Set(prev).add(issue.number));

    try {
      const response = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issue: {
            number: issue.number,
            title: issue.title,
            body: issue.body,
            labels: issue.labels,
            user: issue.user,
            created_at: issue.created_at,
          },
          repository: {
            full_name: `${owner}/${repo}`,
            owner,
            name: repo,
          },
        }),
      });

      if (!response.ok) throw new Error("Failed to create triage session");

      const data = await response.json();
      setPollingTriageIds(prev => new Map(prev).set(issue.number, data.session_id));
      await fetchIssues();
    } catch (err) {
      console.error("Triage error:", err);
      alert("Failed to start triage. Please try again.");
    } finally {
      setTriagingIssues(prev => {
        const next = new Set(prev);
        next.delete(issue.number);
        return next;
      });
    }
  };

  const handleStartPR = async (issue: Issue) => {
    if (!issue.triage?.structuredOutput) {
      alert("Issue must be triaged first");
      return;
    }

    setStartingPRIssues(prev => new Set(prev).add(issue.number));

    try {
      const response = await fetch("/api/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issue: {
            number: issue.number,
            title: issue.title,
            body: issue.body,
            labels: issue.labels,
            user: issue.user,
            created_at: issue.created_at,
          },
          repository: {
            full_name: `${owner}/${repo}`,
            owner,
            name: repo,
          },
          triageResult: issue.triage.structuredOutput,
        }),
      });

      if (!response.ok) throw new Error("Failed to create PR session");

      const data = await response.json();
      setPollingPRIds(prev => new Map(prev).set(issue.number, data.session_id));
      await fetchIssues();
    } catch (err) {
      console.error("Start PR error:", err);
      alert("Failed to start PR creation. Please try again.");
    } finally {
      setStartingPRIssues(prev => {
        const next = new Set(prev);
        next.delete(issue.number);
        return next;
      });
    }
  };

  const getIssuesByStatus = (status: WorkflowStatus): Issue[] => {
    return issues.filter(issue => {
      const workflowStatus = issue.workflow?.workflowStatus;

      if (workflowStatus) {
        return workflowStatus === status;
      }

      if (status === "new") {
        return !issue.triage || issue.triage.status === "pending" || issue.triage.status === "in_progress";
      }
      if (status === "triaged") {
        return issue.triage?.status === "completed" && !issue.workflow;
      }
      if (status === "failed") {
        return issue.triage?.status === "failed";
      }

      return false;
    });
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case "high": return "bg-green-100 text-green-800";
      case "medium": return "bg-yellow-100 text-yellow-800";
      case "low": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const renderIssueCard = (issue: Issue, columnStatus: WorkflowStatus) => {
    const isExpanded = expandedIssue === issue.number;
    const isTriaging = triagingIssues.has(issue.number) || pollingTriageIds.has(issue.number);
    const isStartingPR = startingPRIssues.has(issue.number) || pollingPRIds.has(issue.number);
    const triageResult = issue.triage?.structuredOutput;

    return (
      <div
        key={issue.id}
        className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-2"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <a
              href={issue.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-gray-900 hover:text-blue-600 line-clamp-2"
            >
              {issue.title}
            </a>
            <p className="text-xs text-gray-500 mt-1">
              #{issue.number} by {issue.user?.login || "unknown"}
            </p>
          </div>
          {issue.user && (
            <img
              src={issue.user.avatar_url}
              alt={issue.user.login}
              className="h-6 w-6 rounded-full flex-shrink-0"
            />
          )}
        </div>

        {issue.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {issue.labels.slice(0, 3).map((label, index) => (
              <span
                key={index}
                className="inline-flex items-center rounded-full px-1.5 py-0.5 text-xs"
                style={{
                  backgroundColor: label.color ? `#${label.color}20` : "#e5e7eb",
                  color: label.color ? `#${label.color}` : "#374151",
                }}
              >
                {label.name}
              </span>
            ))}
            {issue.labels.length > 3 && (
              <span className="text-xs text-gray-400">+{issue.labels.length - 3}</span>
            )}
          </div>
        )}

        {triageResult && (
          <div className="mt-2">
            <button
              onClick={() => setExpandedIssue(isExpanded ? null : issue.number)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
            >
              <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium ${getConfidenceColor(triageResult.confidence_score)}`}>
                {triageResult.confidence_score} confidence
              </span>
              <svg
                className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isExpanded && (
              <div className="mt-2 p-2 bg-gray-50 rounded text-xs space-y-2">
                <div>
                  <span className="font-medium">Scope:</span> {triageResult.scope}
                </div>
                <div>
                  <span className="font-medium">Approach:</span> {triageResult.suggested_approach}
                </div>
                <div>
                  <span className="font-medium">Effort:</span> {triageResult.estimated_effort}
                </div>
                {triageResult.blockers.length > 0 && (
                  <div>
                    <span className="font-medium">Blockers:</span>
                    <ul className="list-disc list-inside ml-2">
                      {triageResult.blockers.map((b, i) => <li key={i}>{b}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-2 flex flex-wrap gap-1">
          {columnStatus === "new" && (
            <button
              onClick={() => handleTriage(issue)}
              disabled={isTriaging}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {isTriaging ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                  Triaging...
                </>
              ) : (
                "Triage"
              )}
            </button>
          )}

          {columnStatus === "triaged" && triageResult && (
            <>
              <button
                onClick={() => handleStartPR(issue)}
                disabled={isStartingPR}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              >
                {isStartingPR ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                    Starting...
                  </>
                ) : (
                  "Start PR"
                )}
              </button>
              <button
                onClick={() => handleTriage(issue)}
                disabled={isTriaging}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50"
              >
                Re-triage
              </button>
            </>
          )}

          {columnStatus === "processing" && issue.workflow?.prSessionUrl && (
            <a
              href={issue.workflow.prSessionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200"
            >
              View Devin Session
            </a>
          )}

          {columnStatus === "awaiting_instructions" && issue.workflow?.prSessionUrl && (
            <a
              href={issue.workflow.prSessionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-orange-100 text-orange-700 hover:bg-orange-200"
            >
              Provide Instructions
            </a>
          )}

          {columnStatus === "pr" && issue.workflow?.prUrl && (
            <a
              href={issue.workflow.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200"
            >
              View PR
            </a>
          )}

          {columnStatus === "failed" && (
            <button
              onClick={() => handleTriage(issue)}
              disabled={isTriaging}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
            >
              {isTriaging ? "Retrying..." : "Retry Triage"}
            </button>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-red-600">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-4 min-w-max pb-4">
        {WORKFLOW_COLUMNS.map(column => {
          const columnIssues = getIssuesByStatus(column.status);
          return (
            <div
              key={column.status}
              className={`w-72 flex-shrink-0 rounded-lg ${column.bgColor} p-3`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className={`font-semibold ${column.color}`}>
                  {column.label}
                </h3>
                <span className={`text-sm ${column.color} bg-white rounded-full px-2 py-0.5`}>
                  {columnIssues.length}
                </span>
              </div>
              <div className="space-y-2 max-h-[calc(100vh-250px)] overflow-y-auto">
                {columnIssues.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No issues</p>
                ) : (
                  columnIssues.map(issue => renderIssueCard(issue, column.status))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
