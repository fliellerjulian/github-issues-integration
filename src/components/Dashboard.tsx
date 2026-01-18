"use client";

import { useSession } from "next-auth/react";
import { useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { WorkflowBoard } from "./WorkflowBoard";
import { LoginButton } from "./LoginButton";
import { RepoSelector } from "./RepoSelector";
import { SettingsModal } from "./SettingsModal";

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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
            className="mx-auto h-16 w-16"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect width="32" height="32" rx="8" fill="#000000"/>
            <path
              d="M8 8h8c4.418 0 8 3.582 8 8s-3.582 8-8 8H8V8z"
              fill="#FFFFFF"
            />
            <path
              d="M12 12h4c2.209 0 4 1.791 4 4s-1.791 4-4 4h-4v-8z"
              fill="#000000"
            />
          </svg>
          <h1 className="mt-6 text-3xl font-bold text-gray-900">
            Your Backlog? Handled.
          </h1>
          <p className="mt-2 text-lg text-gray-600">
            Devin triages and resolves your GitHub issues
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
        <div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <svg
              className="h-8 w-8"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect width="32" height="32" rx="8" fill="#000000"/>
              <path
                d="M8 8h8c4.418 0 8 3.582 8 8s-3.582 8-8 8H8V8z"
                fill="#FFFFFF"
              />
              <path
                d="M12 12h4c2.209 0 4 1.791 4 4s-1.791 4-4 4h-4v-8z"
                fill="#000000"
              />
            </svg>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              title="Settings"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
            <LoginButton />
          </div>
        </div>
      </header>

      <main className="px-4 py-4 sm:px-6 lg:px-8">
        {selectedRepo ? (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Issue Workflow: {selectedRepo.owner}/{selectedRepo.repo}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClearRepo}
                  className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                    />
                  </svg>
                  Change Repository
                </button>
                <a
                  href={`https://github.com/${selectedRepo.owner}/${selectedRepo.repo}/issues/new`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Create Issue
                </a>
              </div>
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
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
