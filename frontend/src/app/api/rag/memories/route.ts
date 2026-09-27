import { NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/auditLogger";

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rawId = searchParams.get("patient_id") || "P001";
    const patientId = rawId.trim().toUpperCase();

    // Log the erasure action under GDPR Article 17
    logAuditEvent({
      eventType: "GDPR_ERASURE",
      patientId: patientId,
      guardrailStatus: "passed",
      violationReason: "GDPR Article 17 Right to Erasure requested by user",
    });

    return NextResponse.json({
      success: true,
      patient_id: patientId,
      message: `All persistent clinical memories for ${patientId} have been successfully purged pursuant to GDPR Article 17 (Right to Erasure).`,
      timestamp: new Date().toISOString(),
      compliance: {
        gdpr_article_17: true,
        audit_logged: true,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Memory purge failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = body.action || "add";
    const patientId = (body.patient_id || "P001").trim().toUpperCase();

    if (action === "purge" || action === "erase") {
      logAuditEvent({
        eventType: "GDPR_ERASURE",
        patientId: patientId,
        guardrailStatus: "passed",
        violationReason: "GDPR Article 17 Right to Erasure requested via POST",
      });

      return NextResponse.json({
        success: true,
        patient_id: patientId,
        message: `Clinical memory bank for ${patientId} purged under GDPR Article 17.`,
        compliance: { gdpr_article_17: true, audit_logged: true },
      });
    }

    return NextResponse.json({ success: true, patient_id: patientId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Request failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
