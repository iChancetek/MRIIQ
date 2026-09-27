"use client";

import { useState } from "react";
import PatientInput from "@/components/PatientInput";
import ClinicalNote from "@/components/ClinicalNote";
import RecommendationCard from "@/components/RecommendationCard";
import HumanReview from "@/components/HumanReview";
import MockPdfViewer from "@/components/MockPdfViewer";
import TTSPlayer from "@/components/TTSPlayer";
import FinalOutcome from "@/components/FinalOutcome";
import FloatingRAGAssistant from "@/components/FloatingRAGAssistant";
import ThemeToggle from "@/components/ThemeToggle";
import { authorize, submitReview, type AuthResponse } from "@/lib/api";

type Phase = "input" | "loading" | "review" | "submitting" | "outcome";

export default function Home() {
  const [patientId, setPatientId] = useState("");
  const [clinicalNote, setClinicalNote] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [authResult, setAuthResult] = useState<AuthResponse | null>(null);
  const [finalOutcome, setFinalOutcome] = useState("");
  const [error, setError] = useState("");

  /* ── Preset Case Definitions ────────────────────────────────────────── */
  const PRESET_CASES = [
    {
      id: "P001",
      name: "Alex Morgan",
      ageGender: "44F",
      plan: "Horizon BCBS PPO",
      condition: "L5-S1 Radiculopathy (10w pain, 8w physio)",
      criteriaSummary: "Pain ≥6w ✓ • Physio ≥6w ✓ • Active Plan ✓",
      note: "Back pain for 10 weeks. Physiotherapy for 8 weeks.",
    },
    {
      id: "P002",
      name: "Jordan Lee",
      ageGender: "37M",
      plan: "Aetna Choice POS",
      condition: "Axial Lumbar Strain (9w pain, 0w physio)",
      criteriaSummary: "Pain ≥6w ✓ • Physio 0w ✗ • Active Plan ✓",
      note: "Patient presents with back pain for 9 weeks. No physiotherapy was tried.",
    },
    {
      id: "P003",
      name: "Casey Kim",
      ageGender: "50NB",
      plan: "UnitedHealthcare (Inactive)",
      condition: "Chronic Back Ache (12w pain, 0w physio)",
      criteriaSummary: "Pain ≥6w ✓ • Physio 0w ✗ • Policy Inactive ✗",
      note: "Back pain for 12 weeks. No physiotherapy was tried.",
    },
  ];

  /* ── Phase 1: Submit to /api/authorize ──────────────────────────────── */
  async function handleSubmit() {
    if (!patientId.trim() || !clinicalNote.trim()) return;
    setError("");
    setPhase("loading");
    try {
      const res = await authorize(patientId.trim(), clinicalNote.trim());
      if (res.error) {
        setError(res.error);
        setPhase("input");
        return;
      }
      setAuthResult(res);
      setPhase("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      setPhase("input");
    }
  }

  /* ── Intelligent Patient ID Handler ─────────────────────────────────── */
  const handlePatientIdChange = (rawId: string) => {
    const trimmed = rawId.trim();
    let normalized = trimmed.toUpperCase();

    // Map common shortcuts: "1" -> "P001", "2" -> "P002", "3" -> "P003"
    if (normalized === "1" || normalized === "P1" || normalized === "001") normalized = "P001";
    if (normalized === "2" || normalized === "P2" || normalized === "002") normalized = "P002";
    if (normalized === "3" || normalized === "P3" || normalized === "003") normalized = "P003";

    const matchedPreset = PRESET_CASES.find((p) => p.id === normalized);

    if (matchedPreset) {
      setPatientId(matchedPreset.id);
      setClinicalNote((prevNote) => {
        const isFromPreset = PRESET_CASES.some((p) => p.note === prevNote);
        if (!prevNote.trim() || isFromPreset) {
          return matchedPreset.note;
        }
        return prevNote;
      });
    } else {
      setPatientId(rawId);
      if (!trimmed) {
        setClinicalNote((prevNote) => {
          const isFromPreset = PRESET_CASES.some((p) => p.note === prevNote);
          return isFromPreset ? "" : prevNote;
        });
      }
    }
  };

  /* ── Phase 2: Submit reviewer decision ──────────────────────────────── */
  async function handleReview(decision: string) {
    if (!authResult) return;
    setPhase("submitting");
    try {
      const res = await submitReview(patientId, authResult.thread_id, decision);
      setFinalOutcome(res.final_outcome);
      setPhase("outcome");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed");
      setPhase("review");
    }
  }

  /* ── Reset ──────────────────────────────────────────────────────────── */
  function handleReset() {
    setPhase("input");
    setAuthResult(null);
    setFinalOutcome("");
    setError("");
    setPatientId("");
    setClinicalNote("");
  }

  return (
    <>
      {/* ── Modern Executive App Header ───────────────────────────────── */}
      <header className="app-header">
        <div className="header-brand-wrap">
          <div className="app-logo-card" title="MRI IQ — Autonomous Prior Authorization Intelligence">
            <img
              src="/icons/icon-192x192.png"
              alt="MRI IQ"
              width="42"
              height="42"
              style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "10px" }}
            />
          </div>
          <div>
            <div className="app-logo">
              MRI<span className="accent">IQ</span>
            </div>
            <div className="app-tagline">Clinical Prior Auth Engine</div>
          </div>
        </div>

        <div className="header-center-info">
          <div className="telemetry-beacon">
            <span className="beacon-dot" />
            <span>LangGraph HITL Active</span>
          </div>
          <span className="status-badge info" style={{ fontSize: "0.72rem", padding: "4px 10px" }}>
            CPT 72148
          </span>
        </div>

        <div className="header-actions">
          <ThemeToggle />
          <span
            className="status-badge info"
            style={{
              fontSize: "0.74rem",
              padding: "5px 12px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
            title="Progressive Web App Ready"
          >
            📱 PWA Ready
          </span>
        </div>
      </header>

      {/* ── Main Workspace ────────────────────────────────────────────── */}
      <main className="app-main">
        {/* Error notification banner */}
        {error && (
          <div className="card animate-in" style={{ marginBottom: 24, borderColor: "var(--deny)" }}>
            <p style={{ color: "var(--deny)", fontSize: "0.92rem", fontWeight: 600 }}>
              ⚠ Prior Authorization Error: {error}
            </p>
          </div>
        )}

        {/* ── INPUT PHASE ─────────────────────────────────────────────── */}
        {phase === "input" && (
          <div className="animate-in">
            {/* Modern Hero Welcome */}
            <section className="hero-section">
              <div className="hero-pill">
                <span>⚡ Evidence-Grounded Lumbar Spine MRI Audit</span>
              </div>
              <h1 className="hero-title">
                Prior Authorization <span className="gradient-text">Intelligence</span>
              </h1>
              <p className="hero-subtitle">
                Autonomous clinical documentation extraction, deterministic guideline verification, and real-time physician RAG powered by OpenAI and LangGraph.
              </p>
              <div className="hero-badges-row">
                <span className="hero-feature-tag">🤖 OpenAI gpt-5.6-terra</span>
                <span className="hero-feature-tag">🛡️ Human-in-the-Loop Interruption</span>
                <span className="hero-feature-tag">📋 SOAP Notes Grounding</span>
                <span className="hero-feature-tag">🧠 Dual-Memory RAG</span>
              </div>
            </section>

            {/* Interactive Clinical Case Presets */}
            <div className="presets-container">
              <div className="presets-header-row">
                <span className="presets-title">
                  <span>📂</span> Clinical Case Test Scenarios (Select to Preload)
                </span>
                {patientId && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ padding: "4px 12px", fontSize: "0.75rem", borderRadius: "100px" }}
                    onClick={() => {
                      setPatientId("");
                      setClinicalNote("");
                    }}
                    id="preset-clear"
                    title="Clear current case selection"
                  >
                    ✕ Clear Selection
                  </button>
                )}
              </div>

              <div className="preset-cards-grid">
                {PRESET_CASES.map((preset) => {
                  const isSelected = patientId.trim().toUpperCase() === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className={`preset-card-btn ${isSelected ? "active" : ""}`}
                      onClick={() => handlePatientIdChange(preset.id)}
                      id={`preset-${preset.id.toLowerCase()}`}
                    >
                      <div className="preset-top-row">
                        <div className="preset-patient-badge">
                          <div className="preset-avatar">
                            {preset.id}
                          </div>
                          <div>
                            <div className="preset-name">{preset.name}</div>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                              {preset.ageGender} • {preset.plan}
                            </div>
                          </div>
                        </div>
                        {isSelected && (
                          <span
                            className="status-badge info animate-in"
                            style={{ fontSize: "0.68rem", padding: "2px 8px" }}
                          >
                            ● Selected
                          </span>
                        )}
                      </div>

                      <div className="preset-desc">{preset.condition}</div>

                      <div className="preset-meta-tags">
                        <span className="preset-meta-chip">{preset.criteriaSummary}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Request Intake Card */}
            <div className="card" style={{ marginBottom: 28 }}>
              <div className="card-header">
                <div className="card-icon blue">📋</div>
                <div>
                  <div className="card-title">Authorization Request Intake</div>
                  <div className="card-subtitle">
                    Enter patient ID and attending physician documentation for CPT 72148 review
                  </div>
                </div>
              </div>

              <PatientInput
                value={patientId}
                onChange={handlePatientIdChange}
                onSelectPatient={handlePatientIdChange}
              />
              <ClinicalNote value={clinicalNote} onChange={setClinicalNote} />

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                <button
                  className="btn btn-primary"
                  onClick={handleSubmit}
                  disabled={!patientId.trim() || !clinicalNote.trim()}
                  id="btn-submit-auth"
                  style={{ minWidth: "200px" }}
                >
                  <span>🔍</span>
                  <span>Analyze &amp; Authorize</span>
                </button>

                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                  Guideline criteria: ≥6w pain &amp; ≥6w supervised physical therapy
                </span>
              </div>
            </div>

            {/* PDF preview when a patient ID is entered */}
            {patientId.trim().length >= 3 && (
              <div className="card animate-in" style={{ marginBottom: 28 }}>
                <div className="card-header">
                  <div className="card-icon yellow">📄</div>
                  <div>
                    <div className="card-title">Physician Clinical Document (SOAP Format)</div>
                    <div className="card-subtitle">
                      Formal Clinical Record for {patientId.trim().toUpperCase()}
                    </div>
                  </div>
                </div>
                <MockPdfViewer patientId={patientId.trim()} />
              </div>
            )}
          </div>
        )}

        {/* ── LOADING PHASE ───────────────────────────────────────────── */}
        {phase === "loading" && (
          <div className="card animate-in">
            <div className="loading-state">
              <div className="spinner" />
              <div>
                <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
                  Auditing Clinical Evidence
                </div>
                <div>
                  Extracting facts with <strong>OpenAI gpt-5.6-terra</strong> and executing deterministic prior auth rules...
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── REVIEW PHASE ────────────────────────────────────────────── */}
        {phase === "review" && authResult && (
          <div className="animate-in">
            <RecommendationCard result={authResult} />

            <div className="section-gap">
              <TTSPlayer
                recommendation={authResult.recommendation}
                denialReasons={authResult.denial_reasons}
              />
            </div>

            <div className="section-gap">
              <HumanReview
                recommendation={authResult.recommendation}
                onDecision={handleReview}
              />
            </div>
          </div>
        )}

        {/* ── SUBMITTING PHASE ────────────────────────────────────────── */}
        {phase === "submitting" && (
          <div className="card animate-in">
            <div className="loading-state">
              <div className="spinner" />
              <div>
                <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
                  Finalizing Determination
                </div>
                <div>Resuming LangGraph state machine with reviewer authorization decision...</div>
              </div>
            </div>
          </div>
        )}

        {/* ── OUTCOME PHASE ───────────────────────────────────────────── */}
        {phase === "outcome" && (
          <div className="animate-in">
            <FinalOutcome outcome={finalOutcome} />
            <div className="section-gap" style={{ textAlign: "center" }}>
              <button className="btn btn-primary" onClick={handleReset} id="btn-new-case">
                ← Initiate New Case Review
              </button>
            </div>
          </div>
        )}

        {/* ── Synthetic Data Disclaimer ───────────────────────────────── */}
        <div className="synthetic-notice">
          SYNTHETIC CLINICAL DEMONSTRATION DATA — NOT A REAL PATIENT — FOR PRIOR AUTH EVALUATION TESTING ONLY
        </div>

        {/* ── Page Footer ─────────────────────────────────────────────── */}
        <footer className="app-footer">
          <div className="app-footer-content">
            <span className="footer-credit">
              MRI IQ Developed by <strong>Chancellor Minus</strong>
            </span>
            <span className="footer-dot">•</span>
            <span className="footer-tech">
              Prior Authorization Intelligence Platform
            </span>
          </div>

          <div className="app-footer-compliance">
            <div className="footer-compliance-pill" title="18 HIPAA Safe Harbor identifiers masked before transmission to external LLMs">
              <span className="footer-compliance-dot" />
              <span className="footer-compliance-title">PHI/PII Masking Vault:</span>
              <span className="footer-compliance-desc">Safe Harbor §164.514(b) Bidirectional De-identification</span>
            </div>
            <div className="footer-compliance-pill" title="Audit controls under 45 CFR §164.312(b) and GDPR Article 9 & 17">
              <span className="footer-compliance-dot" />
              <span className="footer-compliance-title">HIPAA &amp; GDPR Compliance:</span>
              <span className="footer-compliance-desc">§164.312(b) Audit Logging • Art. 9 &amp; 17 Right to Erasure • 3-Patient Scope Lock</span>
            </div>
          </div>
        </footer>
      </main>

      {/* ── Dedicated Docked Clinical RAG Assistant (Isolated & Self-Contained) ── */}
      <FloatingRAGAssistant
        selectedPatientId={patientId.trim().toUpperCase()}
      />
    </>
  );
}
