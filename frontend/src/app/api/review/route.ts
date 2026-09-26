import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { decision } = await req.json();

    const normalized = (decision || "").trim().toLowerCase();
    const isApproved = ["yes", "y", "approve", "approved"].includes(normalized);

    const final_outcome = isApproved
      ? "Decision approved by reviewer"
      : "Decision rejected by reviewer";

    return NextResponse.json({ final_outcome });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Review submission failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
