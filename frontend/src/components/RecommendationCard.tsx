"use client";

import { useState } from "react";
import type { AuthResponse } from "@/lib/api";
import { SOAP_PATIENTS } from "@/lib/soapData";
import { speakText, stopSpeech } from "@/lib/speech";

interface Props {
  result: AuthResponse;
}

export default function RecommendationCard({ result }: Props) {
  const [isPlayingSummary, setIsPlayingSummary] = useState(false);
  const isApprove = result.recommendation === "APPROVE";

  const patientId = String(
    (result.patient as Record<string, unknown>)?.patient_id ??
    (result.patient as Record<string, unknown>)?.id ??
    "P001"
  ).toUpperCase();

  const soapRecord = SOAP_PATIENTS[patientId];
  const patientName =
    (result.patient as Record<string, string>)?.name ??
    soapRecord?.name ??
    `Patient ${patientId}`;

  // Build high-yield narrative summary text
  const narrativeSummary =
    soapRecord?.full_summary ??
    `${patientName} (${patientId}) underwent clinical evaluation for Lumbar Spine MRI prior authorization. ` +
    `Documented pain duration is ${result.pain_weeks ?? 0} weeks (clinical threshold: 6 weeks). ` +
    `Supervised physical therapy trial completed: ${result.physio_weeks ?? 0} weeks (clinical threshold: 6 weeks). ` +
    `Health plan status is ${(result.patient as Record<string, boolean>)?.plan_active ? "ACTIVE" : "INACTIVE"}. ` +
    (isApprove
      ? "All evidence-based medical necessity criteria are met. Determination: APPROVE."
      : `Prior authorization criteria not met: ${result.denial_reasons.join(". ")}. Determination: DENY.`);

  const handleToggleSummarySpeech = () => {
    if (isPlayingSummary) {
      stopSpeech();
      setIsPlayingSummary(false);
      return;
    }

    speakText(narrativeSummary, {
      onStart: () => setIsPlayingSummary(true),
      onEnd: () => setIsPlayingSummary(false),
      onError: () => setIsPlayingSummary(false),
    });
  };

  return (
    <div className="card" id="recommendation-card">
      <div className="card-header">
        <div className={`card-icon ${isApprove ? "green" : "red"}`}>
          {isApprove ? "✓" : "✗"}
        </div>
        <div>
          <div className="card-title">Authorization Analysis</div>
          <div className="card-subtitle">
            Patient: {patientName} ({patientId})
          </div>
        </div>
        <span
          className={`status-badge ${isApprove ? "approve" : "deny"}`}
          style={{ marginLeft: "auto" }}
        >
          {isApprove ? "● Approve" : "● Deny"}
        </span>
      </div>

      {/* Extracted facts grid */}
      <div className="fact-grid">
        <div className="fact-item">
          <div className="fact-value">
            {result.pain_weeks != null ? result.pain_weeks : "—"}
          </div>
          <div className="fact-label">Pain Weeks (Req: ≥6)</div>
        </div>
        <div className="fact-item">
          <div className="fact-value">
            {result.physio_weeks != null ? result.physio_weeks : "—"}
          </div>
          <div className="fact-label">Physio Weeks (Req: ≥6)</div>
        </div>
        <div className="fact-item">
          <div className="fact-value" style={{ fontSize: "1.1rem" }}>
            {(result.patient as Record<string, boolean>).plan_active ? "Active" : "Inactive"}
          </div>
          <div className="fact-label">Insurance Plan</div>
        </div>
      </div>

      {/* ── Clinical Summary Section ─────────────────────────────────── */}
      <div
        className="summary-box"
        style={{
          marginTop: "16px",
          padding: "18px 20px",
          background: "rgba(56, 189, 248, 0.05)",
          border: "1px solid rgba(56, 189, 248, 0.2)",
          borderRadius: "var(--radius-md)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "1.1rem" }}>📝</span>
            <span
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "var(--accent)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Physician Clinical Summary &amp; Determination
            </span>
          </div>

          <button
            type="button"
            className="btn btn-ghost"
            style={{
              padding: "4px 10px",
              fontSize: "0.78rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
            }}
            onClick={handleToggleSummarySpeech}
            id="btn-speak-summary"
            title={isPlayingSummary ? "Stop audio" : "Listen to summary via TTS"}
          >
            {isPlayingSummary ? (
              <>
                <span style={{ color: "var(--deny)" }}>⏹</span>
                <span>Stop Audio</span>
              </>
            ) : (
              <>
                <span style={{ color: "var(--accent)" }}>🔊</span>
                <span>Listen to Summary</span>
              </>
            )}
          </button>
        </div>

        <p
          style={{
            fontSize: "0.92rem",
            color: "var(--text-primary)",
            lineHeight: 1.65,
            whiteSpace: "pre-line",
          }}
        >
          {narrativeSummary}
        </p>
      </div>

      {/* Denial reasons */}
      {result.denial_reasons.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div
            style={{
              fontSize: "0.82rem",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              fontWeight: 500,
              marginBottom: 8,
            }}
          >
            Specific Denial Reasons
          </div>
          <ul className="denial-list">
            {result.denial_reasons.map((reason, i) => (
              <li key={i} className="denial-item">
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
