"use client";

import type { AuthResponse } from "@/lib/api";

interface Props {
  result: AuthResponse;
}

export default function RecommendationCard({ result }: Props) {
  const isApprove = result.recommendation === "APPROVE";

  return (
    <div className="card">
      <div className="card-header">
        <div className={`card-icon ${isApprove ? "green" : "red"}`}>
          {isApprove ? "✓" : "✗"}
        </div>
        <div>
          <div className="card-title">Authorization Analysis</div>
          <div className="card-subtitle">
            Patient: {(result.patient as Record<string, string>).name ?? result.patient.patient_id ?? "—"}
          </div>
        </div>
        <span
          className={`status-badge ${isApprove ? "approve" : "deny"}`}
          style={{ marginLeft: "auto" }}
        >
          {isApprove ? "● Approve" : "● Deny"}
        </span>
      </div>

      {/* Extracted facts */}
      <div className="fact-grid">
        <div className="fact-item">
          <div className="fact-value">
            {result.pain_weeks != null ? result.pain_weeks : "—"}
          </div>
          <div className="fact-label">Pain Weeks</div>
        </div>
        <div className="fact-item">
          <div className="fact-value">
            {result.physio_weeks != null ? result.physio_weeks : "—"}
          </div>
          <div className="fact-label">Physio Weeks</div>
        </div>
        <div className="fact-item">
          <div className="fact-value" style={{ fontSize: "1.1rem" }}>
            {(result.patient as Record<string, boolean>).plan_active ? "Active" : "Inactive"}
          </div>
          <div className="fact-label">Insurance Plan</div>
        </div>
      </div>

      {/* Denial reasons */}
      {result.denial_reasons.length > 0 && (
        <>
          <div
            style={{
              fontSize: "0.82rem",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              fontWeight: 500,
              marginTop: 8,
            }}
          >
            Denial Reasons
          </div>
          <ul className="denial-list">
            {result.denial_reasons.map((reason, i) => (
              <li key={i} className="denial-item">
                {reason}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
