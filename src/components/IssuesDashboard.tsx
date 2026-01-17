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
}

interface TriageStatus {
  session_id: string;
  session_url: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  result?: {
    scope: string;
    complexity: "low" | "medium" | "high";
    estimated_effort: string;
    confidence_score: "low" | "medium" | "high";
    confidence_reasoning: string;
    suggested_approach: string;
    blockers: string[];
    requires_human_input: boolean;
  };
}

interface IssuesDashboardProps {
  owner: string;
  repo: string;
}

export function IssuesDashboard({ owner, repo }: IssuesDashboardProps) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triageStatuses, setTriageStatuses] = useState<Record<number, TriageStatus>>({});
  const [triagingIssues, setTriagingIssues] = useState<Set<number>>(new Set());
  const [expandedTriageIssues, setExpandedTriageIssues] = useState<Set<number>>(new Set());
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const toggleTriageExpanded = (issueNumber: number) => {
    setExpandedTriageIssues((prev) => {
      const next = new Set(prev);
      if (next.has(issueNumber)) {
        next.delete(issueNumber);
      } else {
        next.add(issueNumber);
      }
      return next;
    });
  };

  useEffect(() => {
    async function fetchIssues() {
      setLoading(true);
      setError(null);
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
      } finally {
        setLoading(false);
      }
    }

    fetchIssues();
  }, [owner, repo]);

  const pollTriageStatus = useCallback(async (issueNumber: number, sessionId: string) => {
    try {
      const response = await fetch(`/api/triage?session_id=${encodeURIComponent(sessionId)}`);
      if (!response.ok) {
        return null;
      }
      const data = await response.json();
      return data;
    } catch (err) {
      console.error("Error polling triage status:", err);
      return null;
    }
  }, []);

  useEffect(() => {
    const inProgressSessions = Object.entries(triageStatuses).filter(
      ([, status]) => !status.result && status.status !== "completed" && status.status !== "failed"
    );

    if (inProgressSessions.length === 0) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    if (pollingIntervalRef.current) {
      return;
    }

    pollingIntervalRef.current = setInterval(async () => {
      for (const [issueNumberStr, status] of inProgressSessions) {
        const issueNumber = parseInt(issueNumberStr, 10);
        const data = await pollTriageStatus(issueNumber, status.session_id);
        
        if (!data) {
          continue;
        }
        
        if (data.error || (data.is_complete && !data.triage_result)) {
          setTriageStatuses((prev) => ({
            ...prev,
            [issueNumber]: {
              ...prev[issueNumber],
              status: "failed",
            },
          }));
        } else if (data.triage_result || data.is_complete) {
          setTriageStatuses((prev) => ({
            ...prev,
            [issueNumber]: {
              ...prev[issueNumber],
              status: "completed",
              result: data.triage_result || undefined,
            },
          }));
        }
      }
    }, 5000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [triageStatuses, pollTriageStatus]);

  const handleTriage = async (issue: Issue) => {
    setTriagingIssues((prev) => new Set(prev).add(issue.number));

    try {
      const response = await fetch("/api/triage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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

      if (!response.ok) {
        throw new Error("Failed to create triage session");
      }

      const data = await response.json();
      setTriageStatuses((prev) => ({
        ...prev,
        [issue.number]: {
          session_id: data.session_id,
          session_url: data.session_url,
          status: "pending",
        },
      }));
    } catch (err) {
      console.error("Triage error:", err);
      alert("Failed to start triage. Please try again.");
    } finally {
      setTriagingIssues((prev) => {
        const next = new Set(prev);
        next.delete(issue.number);
        return next;
      });
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case "high":
        return "bg-green-100 text-green-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "low":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case "high":
        return "bg-red-100 text-red-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "low":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const renderTriageDetails = (result: TriageResult) => (
    <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Scope</h4>
          <p className="text-sm text-gray-600">{result.scope}</p>
        </div>
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Suggested Approach</h4>
          <p className="text-sm text-gray-600">{result.suggested_approach}</p>
        </div>
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Complexity</h4>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getComplexityColor(result.complexity)}`}>
            {result.complexity}
          </span>
        </div>
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Estimated Effort</h4>
          <p className="text-sm text-gray-600">{result.estimated_effort}</p>
        </div>
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Confidence Reasoning</h4>
          <p className="text-sm text-gray-600">{result.confidence_reasoning}</p>
        </div>
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Requires Human Input</h4>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${result.requires_human_input ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}`}>
            {result.requires_human_input ? "Yes" : "No"}
          </span>
        </div>
        {result.blockers && result.blockers.length > 0 && (
          <div className="md:col-span-2">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Blockers</h4>
            <ul className="list-disc list-inside text-sm text-gray-600">
              {result.blockers.map((blocker, index) => (
                <li key={index}>{blocker}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );

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

  if (issues.length === 0) {
    return (
      <div className="rounded-lg bg-gray-50 p-8 text-center">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-gray-900">No open issues</h3>
        <p className="mt-2 text-gray-500">
          This repository has no open issues. Great job!
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Issue
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Labels
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Created
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Devin Triage
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {issues.map((issue) => {
            const triageResult = triageStatuses[issue.number]?.result || issue.triage?.structuredOutput;
            const isExpanded = expandedTriageIssues.has(issue.number);
            const hasTriageResult = !!triageResult;
            
            return (
              <React.Fragment key={issue.id}>
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-start gap-3">
                      {issue.user && (
                        <img
                          src={issue.user.avatar_url}
                          alt={issue.user.login}
                          className="h-8 w-8 rounded-full"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <a
                          href={issue.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-gray-900 hover:text-blue-600"
                        >
                          {issue.title}
                        </a>
                        <p className="mt-1 text-sm text-gray-500">
                          #{issue.number} opened by {issue.user?.login || "unknown"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {issue.labels.map((label, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: label.color
                              ? `#${label.color}20`
                              : "#e5e7eb",
                            color: label.color ? `#${label.color}` : "#374151",
                            border: `1px solid ${label.color ? `#${label.color}40` : "#d1d5db"}`,
                          }}
                        >
                          {label.name}
                        </span>
                      ))}
                      {issue.labels.length === 0 && (
                        <span className="text-sm text-gray-400">No labels</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                      {issue.state}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {new Date(issue.created_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="px-6 py-4">
                    {triageStatuses[issue.number] ? (
                      <div className="flex flex-col gap-1">
                        {triageStatuses[issue.number].result ? (
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getConfidenceColor(
                                triageStatuses[issue.number].result!.confidence_score
                              )}`}
                            >
                              {triageStatuses[issue.number].result!.confidence_score} confidence
                            </span>
                            <button
                              onClick={() => toggleTriageExpanded(issue.number)}
                              className="text-gray-500 hover:text-gray-700 transition-colors"
                              title={isExpanded ? "Collapse details" : "Expand details"}
                            >
                              <svg
                                className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          </div>
                        ) : triageStatuses[issue.number].status === "failed" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span>
                            Failed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500"></span>
                            In Progress
                          </span>
                        )}
                        <a
                          href={triageStatuses[issue.number].session_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline"
                        >
                          View Session
                        </a>
                      </div>
                    ): issue.triage ? (
                      <div className="flex flex-col gap-1">
                        {issue.triage.status === "completed" && issue.triage.confidence ? (
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getConfidenceColor(
                                issue.triage.confidence
                              )}`}
                            >
                              {issue.triage.confidence} confidence
                            </span>
                            {issue.triage.structuredOutput && (
                              <button
                                onClick={() => toggleTriageExpanded(issue.number)}
                                className="text-gray-500 hover:text-gray-700 transition-colors"
                                title={isExpanded ? "Collapse details" : "Expand details"}
                              >
                                <svg
                                  className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            )}
                          </div>
                        ) : issue.triage.status === "failed" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span>
                            Failed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500"></span>
                            In Progress
                          </span>
                        )}
                        {issue.triage.sessionUrl && (
                          <a
                            href={issue.triage.sessionUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline"
                          >
                            View Session
                          </a>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">Not triaged</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <button
                      onClick={() => handleTriage(issue)}
                      disabled={triagingIssues.has(issue.number)}
                      className="inline-flex items-center gap-1 rounded-md bg-purple-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {triagingIssues.has(issue.number) ? (
                        <>
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                          Triaging...
                        </>
                      ) : triageStatuses[issue.number] || issue.triage ? (
                        "Re-triage"
                      ) : (
                        "Triage with Devin"
                      )}
                    </button>
                  </td>
                </tr>
                {isExpanded && hasTriageResult && triageResult && (
                  <tr>
                    <td colSpan={6} className="p-0">
                      {renderTriageDetails(triageResult)}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
