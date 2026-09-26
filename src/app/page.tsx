"use client";

import { useState } from "react";
import PatientInput from "@/components/PatientInput";
import ClinicalNote from "@/components/ClinicalNote";
import RecommendationCard from "@/components/RecommendationCard";
import HumanReview from "@/components/HumanReview";
import MockPdfViewer from "@/components/MockPdfViewer";
import TTSPlayer from "@/components/TTSPlayer";
import FinalOutcome from "@/components/FinalOutcome";
import SOAPRagChat from "@/components/SOAPRagChat";
import FloatingRAGAssistant from "@/components/FloatingRAGAssistant";
import { authorize, submitReview, type AuthResponse } from "@/lib/api";

type Phase = "input" | "loading" | "review" | "submitting" | "outcome";

export default function Home() {
  const [patientId, setPatientId] = useState("P001");
  const [clinicalNote, setClinicalNote] = useState("Back pain for 10 weeks. Physiotherapy for 8 weeks.");
  const [phase, setPhase] = useState<Phase>("input");
  const [authResult, setAuthResult] = useState<AuthResponse | null>(null);
  const [finalOutcome, setFinalOutcome] = useState("");
  const [error, setError] = useState("");

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
    setClinicalNote("Back pain for 10 weeks. Physiotherapy for 8 weeks.");
  }

  return (
    <>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="app-header">
        <div className="app-logo-icon">IQ</div>
        <div className="app-logo">
          MRI<span className="accent">IQ</span>
        </div>
        <span className="app-badge">Prior Auth Engine</span>
      </header>

      {/* ── Main Content ────────────────────────────────────────────────── */}
      <main className="app-main">
        {/* Error banner */}
        {error && (
          <div className="card animate-in" style={{ marginBottom: 20, borderColor: "var(--deny)" }}>
            <p style={{ color: "var(--deny)", fontSize: "0.9rem" }}>⚠ {error}</p>
          </div>
        )}

        {/* ── INPUT PHASE ─────────────────────────────────────────────── */}
        {phase === "input" && (
          <div className="animate-in">
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header">
                <div className="card-icon blue">📋</div>
                <div>
                  <div className="card-title">New Authorization Request</div>
                  <div className="card-subtitle">
                    Enter patient ID and clinical note for MRI prior authorization
                  </div>
                </div>
              </div>

              {/* Quick test presets */}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "18px", alignItems: "center" }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Quick Presets:
                </span>
                <button
                  type="button"
                  className={patientId === "P001" ? "btn btn-primary" : "btn btn-ghost"}
                  style={{ padding: "4px 12px", fontSize: "0.8rem" }}
                  onClick={() => {
                    setPatientId("P001");
                    setClinicalNote("Back pain for 10 weeks. Physiotherapy for 8 weeks.");
                  }}
                  id="preset-p001"
                >
                  P001
                </button>
                <button
                  type="button"
                  className={patientId === "P002" ? "btn btn-primary" : "btn btn-ghost"}
                  style={{ padding: "4px 12px", fontSize: "0.8rem" }}
                  onClick={() => {
                    setPatientId("P002");
                    setClinicalNote("Patient presents with back pain for 9 weeks. No physiotherapy was tried.");
                  }}
                  id="preset-p002"
                >
                  P002
                </button>
                <button
                  type="button"
                  className={patientId === "P003" ? "btn btn-primary" : "btn btn-ghost"}
                  style={{ padding: "4px 12px", fontSize: "0.8rem" }}
                  onClick={() => {
                    setPatientId("P003");
                    setClinicalNote("Back pain for 12 weeks. No physiotherapy was tried.");
                  }}
                  id="preset-p003"
                >
                  P003
                </button>
              </div>

              <PatientInput value={patientId} onChange={setPatientId} />
              <ClinicalNote value={clinicalNote} onChange={setClinicalNote} />
              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={!patientId.trim() || !clinicalNote.trim()}
                id="btn-submit-auth"
              >
                🔍 Analyze &amp; Authorize
              </button>
            </div>

            {/* PDF preview when a patient ID is entered */}
            {patientId.trim() && (
              <div className="card animate-in">
                <div className="card-header">
                  <div className="card-icon yellow">📄</div>
                  <div>
                    <div className="card-title">Synthetic Clinical Document (SOAP Format)</div>
                    <div className="card-subtitle">
                      Formal Physician Clinical Report for {patientId.trim().toUpperCase()}
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
                Extracting clinical facts with <strong>gpt-5.6-terra</strong>
                &nbsp;and applying authorization rules...
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
              <div>Processing reviewer decision...</div>
            </div>
          </div>
        )}

        {/* ── OUTCOME PHASE ───────────────────────────────────────────── */}
        {phase === "outcome" && (
          <div className="animate-in">
            <FinalOutcome outcome={finalOutcome} />
            <div className="section-gap" style={{ textAlign: "center" }}>
              <button className="btn btn-ghost" onClick={handleReset} id="btn-new-case">
                ← Start New Case
              </button>
            </div>
          </div>
        )}

        {/* ── Interactive SOAP Clinical Documentation & RAG Q&A Assistant ────────────────────────────── */}
        <SOAPRagChat
          selectedPatientId={patientId}
          onSelectPatient={(id) => {
            setPatientId(id);
            if (id === "P001") {
              setClinicalNote("Back pain for 10 weeks. Physiotherapy for 8 weeks.");
            } else if (id === "P002") {
              setClinicalNote("Patient presents with back pain for 9 weeks. No physiotherapy was tried.");
            } else if (id === "P003") {
              setClinicalNote("Back pain for 12 weeks. No physiotherapy was tried.");
            }
          }}
        />

        {/* ── Synthetic data notice ───────────────────────────────────── */}
        <div className="synthetic-notice">
          SYNTHETIC DATA — NOT A REAL PATIENT
        </div>
      </main>

      {/* ── Docked Bottom-Right Clinical RAG Assistant with Dual Memory ── */}
      <FloatingRAGAssistant
        selectedPatientId={patientId}
        onSelectPatient={(id) => {
          setPatientId(id);
          if (id === "P001") {
            setClinicalNote("Back pain for 10 weeks. Physiotherapy for 8 weeks.");
          } else if (id === "P002") {
            setClinicalNote("Patient presents with back pain for 9 weeks. No physiotherapy was tried.");
          } else if (id === "P003") {
            setClinicalNote("Back pain for 12 weeks. No physiotherapy was tried.");
          }
        }}
      />
    </>
  );
}
