import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import {
  createTriageSession,
  getSessionDetails,
  postTriageResultToGitHub,
  TriageResult,
} from "@/lib/devin";

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

    const devinSession = await createTriageSession(issue, repository);

    await postTriageResultToGitHub(
      repository.owner,
      repository.name,
      issue.number,
      devinSession.url,
      null,
      session.accessToken
    );

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

    let triageResult: TriageResult | null = null;
    if (sessionDetails.structured_output) {
      triageResult = sessionDetails.structured_output;
    }

    return NextResponse.json({
      session_id: sessionDetails.session_id,
      status: sessionDetails.status,
      triage_result: triageResult,
    });
  } catch (error) {
    console.error("Error fetching session details:", error);
    return NextResponse.json(
      { error: "Failed to fetch session details" },
      { status: 500 }
    );
  }
}
