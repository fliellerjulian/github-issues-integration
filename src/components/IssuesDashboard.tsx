"use client";

import { useEffect, useState } from "react";

interface Label {
  name: string | undefined;
  color: string | undefined;
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
}

interface IssuesDashboardProps {
  owner: string;
  repo: string;
}

export function IssuesDashboard({ owner, repo }: IssuesDashboardProps) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {issues.map((issue) => (
            <tr key={issue.id} className="hover:bg-gray-50">
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
