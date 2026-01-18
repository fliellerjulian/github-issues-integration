"use client";

import { useState, useEffect, useCallback } from "react";

interface UserSettings {
  auto_triage_enabled: boolean;
  auto_pr_enabled: boolean;
  pr_confidence_threshold: "low" | "medium" | "high";
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [settings, setSettings] = useState<UserSettings>({
    auto_triage_enabled: true,
    auto_pr_enabled: true,
    pr_confidence_threshold: "high",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/settings");
      if (!response.ok) {
        throw new Error("Failed to fetch settings");
      }
      const data = await response.json();
      setSettings({
        auto_triage_enabled: data.auto_triage_enabled,
        auto_pr_enabled: data.auto_pr_enabled,
        pr_confidence_threshold: data.pr_confidence_threshold,
      });
    } catch (err) {
      setError("Failed to load settings");
      console.error("Error fetching settings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
    }
  }, [isOpen, fetchSettings]);

  const handleSave = async (newSettings: Partial<UserSettings>) => {
    try {
      setSaving(true);
      setError(null);
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newSettings),
      });
      if (!response.ok) {
        throw new Error("Failed to save settings");
      }
      const data = await response.json();
      setSettings({
        auto_triage_enabled: data.auto_triage_enabled,
        auto_pr_enabled: data.auto_pr_enabled,
        pr_confidence_threshold: data.pr_confidence_threshold,
      });
    } catch (err) {
      setError("Failed to save settings");
      console.error("Error saving settings:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAutoTriage = () => {
    const newValue = !settings.auto_triage_enabled;
    setSettings((prev) => ({ ...prev, auto_triage_enabled: newValue }));
    handleSave({ auto_triage_enabled: newValue });
  };

  const handleToggleAutoPR = () => {
    const newValue = !settings.auto_pr_enabled;
    setSettings((prev) => ({ ...prev, auto_pr_enabled: newValue }));
    handleSave({ auto_pr_enabled: newValue });
  };

  const handleThresholdChange = (threshold: "low" | "medium" | "high") => {
    setSettings((prev) => ({ ...prev, pr_confidence_threshold: threshold }));
    handleSave({ pr_confidence_threshold: threshold });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-50 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">
                    Auto-triage incoming issues
                  </h3>
                  <p className="text-sm text-gray-500">
                    Automatically triage new issues when they are created
                  </p>
                </div>
                <button
                  onClick={handleToggleAutoTriage}
                  disabled={saving}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    settings.auto_triage_enabled ? "bg-blue-600" : "bg-gray-200"
                  } ${saving ? "opacity-50" : ""}`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      settings.auto_triage_enabled
                        ? "translate-x-5"
                        : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">
                      Auto-start PR sessions
                    </h3>
                    <p className="text-sm text-gray-500">
                      Automatically start Devin PR sessions after triage
                    </p>
                  </div>
                  <button
                    onClick={handleToggleAutoPR}
                    disabled={saving}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      settings.auto_pr_enabled ? "bg-blue-600" : "bg-gray-200"
                    } ${saving ? "opacity-50" : ""}`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        settings.auto_pr_enabled
                          ? "translate-x-5"
                          : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">
                    PR confidence threshold
                  </h3>
                  <p className="mb-3 text-sm text-gray-500">
                    Minimum confidence level required to auto-start PR sessions
                  </p>
                  <select
                    value={settings.pr_confidence_threshold}
                    onChange={(e) =>
                      handleThresholdChange(
                        e.target.value as "low" | "medium" | "high"
                      )
                    }
                    disabled={saving || !settings.auto_pr_enabled}
                    className={`block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                      !settings.auto_pr_enabled ? "opacity-50" : ""
                    }`}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
