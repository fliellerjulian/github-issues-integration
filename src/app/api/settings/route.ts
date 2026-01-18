import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { getUserSettings, updateUserSettings } from "@/lib/supabase";

export async function GET() {
  const session = await auth();

  if (!session?.accessToken || !session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await getUserSettings(session.userId);
    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error fetching user settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.accessToken || !session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { auto_triage_enabled, auto_pr_enabled, pr_confidence_threshold } = body;

    const validThresholds = ["low", "medium", "high"];
    if (pr_confidence_threshold && !validThresholds.includes(pr_confidence_threshold)) {
      return NextResponse.json(
        { error: "Invalid confidence threshold. Must be 'low', 'medium', or 'high'" },
        { status: 400 }
      );
    }

    const updates: Record<string, boolean | string> = {};
    if (typeof auto_triage_enabled === "boolean") {
      updates.auto_triage_enabled = auto_triage_enabled;
    }
    if (typeof auto_pr_enabled === "boolean") {
      updates.auto_pr_enabled = auto_pr_enabled;
    }
    if (pr_confidence_threshold) {
      updates.pr_confidence_threshold = pr_confidence_threshold;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid settings provided" },
        { status: 400 }
      );
    }

    const updatedSettings = await updateUserSettings(session.userId, updates);

    if (!updatedSettings) {
      return NextResponse.json(
        { error: "Failed to update settings" },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedSettings);
  } catch (error) {
    console.error("Error updating user settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
