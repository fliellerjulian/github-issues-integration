"use client";

import { useEffect, useState } from "react";

interface Repo {
  id: number;
  name: string;
  full_name: string;
  owner: string;
  private: boolean;
  open_issues_count: number;
  updated_at: string;
}

interface RepoSelectorProps {
  onSelectRepo: (owner: string, repo: string) => void;
  selectedRepo: string | null;
}

export function RepoSelector({ onSelectRepo, selectedRepo }: RepoSelectorProps) {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function fetchRepos() {
      try {
        const response = await fetch("/api/repos");
        if (!response.ok) {
          throw new Error("Failed to fetch repositories");
        }
        const data = await response.json();
        setRepos(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    fetchRepos();
  }, []);

  const filteredRepos = repos.filter((repo) =>
    repo.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600"></div>
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
    <div className="space-y-4">
      <div className="relative">
        <input
          type="text"
          placeholder="Search repositories..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-4 py-2 pl-10 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <svg
          className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200">
        {filteredRepos.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            No repositories found
          </div>
        ) : (
          filteredRepos.map((repo) => (
            <button
              key={repo.id}
              onClick={() => onSelectRepo(repo.owner, repo.name)}
              className={`flex w-full items-center justify-between border-b border-gray-100 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-gray-50 ${
                selectedRepo === repo.full_name ? "bg-blue-50" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <svg
                  className="h-5 w-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  />
                </svg>
                <div>
                  <div className="font-medium text-gray-900">{repo.full_name}</div>
                  <div className="text-sm text-gray-500">
                    {repo.private ? "Private" : "Public"} · Updated{" "}
                    {new Date(repo.updated_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
                  {repo.open_issues_count} issues
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
