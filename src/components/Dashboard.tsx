"use client";

import { useSession } from "next-auth/react";
import { useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { WorkflowBoard } from "./WorkflowBoard";
import { LoginButton } from "./LoginButton";
import { RepoSelector } from "./RepoSelector";

function getInitialRepo(searchParams: URLSearchParams): { owner: string; repo: string } | null {
  const repoParam = searchParams.get("repo");
  if (repoParam && repoParam.includes("/")) {
    const [owner, repo] = repoParam.split("/");
    return { owner, repo };
  }
  return null;
}

export function Dashboard() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [selectedRepo, setSelectedRepo] = useState<{
    owner: string;
    repo: string;
  } | null>(() => getInitialRepo(searchParams));

  const handleSelectRepo = useCallback((owner: string, repo: string) => {
    setSelectedRepo({ owner, repo });
    router.push(`?repo=${owner}/${repo}`, { scroll: false });
  }, [router]);

  const handleClearRepo = useCallback(() => {
    setSelectedRepo(null);
    router.push("/", { scroll: false });
  }, [router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-white">
        <div className="text-center">
          <svg
            className="mx-auto h-16 w-16 text-gray-900"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              fillRule="evenodd"
              d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              clipRule="evenodd"
            />
          </svg>
          <h1 className="mt-6 text-3xl font-bold text-gray-900">
            GitHub Issues Integration
          </h1>
          <p className="mt-2 text-lg text-gray-600">
            Triage and resolve GitHub issues with ease
          </p>
          <div className="mt-8">
            <LoginButton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <svg
              className="h-8 w-8 text-gray-900"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                fillRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                clipRule="evenodd"
              />
            </svg>
            <h1 className="text-xl font-semibold text-gray-900">
              GitHub Issues
            </h1>
          </div>
          <LoginButton />
        </div>
      </header>

      <main className="px-4 py-8 sm:px-6 lg:px-8">
        {selectedRepo ? (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Issue Workflow: {selectedRepo.owner}/{selectedRepo.repo}
              </h2>
              <button
                onClick={handleClearRepo}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Change repository
              </button>
            </div>
            <WorkflowBoard
              owner={selectedRepo.owner}
              repo={selectedRepo.repo}
            />
          </div>
        ) : (
          <div className="mx-auto max-w-2xl">
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Select Repository
              </h2>
              <RepoSelector
                onSelectRepo={handleSelectRepo}
                selectedRepo={null}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
