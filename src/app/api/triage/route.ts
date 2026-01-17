import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import {
  createTriageSession as createDevinSession,
  getSessionDetails,
} from "@/lib/devin";
import {
  createTriageSession,
  updateTriageSession,
} from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { issue, repository } = body;

    if (!issue || !repository) {
      return NextResponse.json(
        { error: "Missing issue or repository data" },
        { status: 400 }
      );
    }

    const devinSession = await createDevinSession(issue, repository);

    await createTriageSession({
      repo_owner: repository.owner,
      repo_name: repository.name,
      issue_number: issue.number,
      session_id: devinSession.session_id,
      session_url: devinSession.url,
      status: "in_progress",
    });

    return NextResponse.json({
      session_id: devinSession.session_id,
      session_url: devinSession.url,
      message: "Triage session created",
    });
  } catch (error) {
    console.error("Error creating triage session:", error);
    return NextResponse.json(
      { error: "Failed to create triage session" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const sessionId = searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json(
      { error: "Missing session_id parameter" },
      { status: 400 }
    );
  }

  try {
    const sessionDetails = await getSessionDetails(sessionId);

    const isCompleted =
      sessionDetails.status === "stopped" ||
      sessionDetails.status === "blocked";

    if (isCompleted && sessionDetails.structured_output) {
      await updateTriageSession(sessionId, {
        status: "completed",
        structured_output: sessionDetails.structured_output,
      });
    } else if (sessionDetails.status === "error") {
      await updateTriageSession(sessionId, {
        status: "failed",
      });
    }

    return NextResponse.json({
      session_id: sessionDetails.session_id,
      status: sessionDetails.status,
      triage_result: sessionDetails.structured_output || null,
    });
  } catch (error) {
    console.error("Error fetching session details:", error);
    return NextResponse.json(
      { error: "Failed to fetch session details" },
      { status: 500 }
    );
  }
}
