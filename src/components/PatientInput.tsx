"use client";

import { SOAP_PATIENTS, type SoapPatientRecord } from "@/lib/soapData";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSelectPatient?: (id: string) => void;
}

export default function PatientInput({ value, onChange, onSelectPatient }: Props) {
  const normalized = value.trim().toUpperCase();
  const matchedPatient: SoapPatientRecord | null =
    normalized && SOAP_PATIENTS[normalized] ? SOAP_PATIENTS[normalized] : null;

  return (
    <div className="form-group">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
        <label htmlFor="patient-id" className="form-label" style={{ marginBottom: 0 }}>
          Patient ID
        </label>
        {matchedPatient && (
          <span
            className="status-badge approve animate-in"
            style={{ fontSize: "0.72rem", padding: "2px 8px" }}
          >
            ✓ Patient Record Found
          </span>
        )}
      </div>

      <div style={{ position: "relative" }}>
        <input
          id="patient-id"
          className="form-input"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type patient ID (e.g. P001, P002, P003)..."
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          style={{
            borderColor: matchedPatient ? "var(--approve)" : undefined,
            boxShadow: matchedPatient ? "0 0 0 2px var(--approve-soft)" : undefined,
          }}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            style={{
              position: "absolute",
              right: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              fontSize: "0.9rem",
              padding: "4px",
            }}
            title="Clear patient ID"
            aria-label="Clear patient ID"
          >
            ✕
          </button>
        )}
      </div>

      {/* Quick-Pick Patient Buttons */}
      <div className="patient-quick-row">
        <span className="patient-quick-label">Known Records:</span>
        {Object.values(SOAP_PATIENTS).map((p) => {
          const isCurrent = normalized === p.id;
          return (
            <button
              key={p.id}
              type="button"
              className={`patient-quick-pill ${isCurrent ? "active" : ""}`}
              onClick={() => {
                onChange(p.id);
                onSelectPatient?.(p.id);
              }}
              title={`Load ${p.name} (${p.id})`}
            >
              <strong>{p.id}</strong> — {p.name}
            </button>
          );
        })}
      </div>

      {/* Verified Patient Identification Card */}
      {matchedPatient && (
        <div className="patient-match-card animate-in">
          <div className="patient-match-avatar">
            {matchedPatient.gender === "Female" ? "👩" : "👨"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span style={{ fontWeight: 700, fontSize: "0.92rem", color: "var(--text-primary)" }}>
                {matchedPatient.name}
              </span>
              <span style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
                ({matchedPatient.id})
              </span>
              <span
                className={`status-badge ${matchedPatient.plan_status === "ACTIVE" ? "approve" : "deny"}`}
                style={{ fontSize: "0.68rem", padding: "2px 8px" }}
              >
                {matchedPatient.plan_status === "ACTIVE" ? "✓ Plan Active" : "✗ Policy Inactive"}
              </span>
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "2px" }}>
              {matchedPatient.dob} • {matchedPatient.gender} • {matchedPatient.plan_name} • Dr. {matchedPatient.provider.split(",")[0].replace("Dr. ", "")}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              className="status-badge approve"
              style={{ fontSize: "0.72rem", padding: "4px 8px", whiteSpace: "nowrap" }}
            >
              ✓ Note Linked
            </span>
          </div>
        </div>
      )}

      {/* Notice for unrecognized ID */}
      {!matchedPatient && normalized.length >= 3 && (
        <div
          className="animate-in"
          style={{
            marginTop: "6px",
            padding: "8px 12px",
            borderRadius: "var(--radius-sm)",
            background: "var(--warning-soft)",
            border: "1px solid rgba(245, 158, 11, 0.25)",
            fontSize: "0.78rem",
            color: "var(--warning)",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span>ℹ</span>
          <span>
            Custom patient <strong>{normalized}</strong> entered. Enter clinical note below to audit.
          </span>
        </div>
      )}
    </div>
  );
}
