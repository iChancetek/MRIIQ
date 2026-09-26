"use client";

import { useState, useEffect, useRef } from "react";
import { SOAP_PATIENTS, type SoapPatientRecord } from "@/lib/soapData";
import { querySoapRag, type RagResponse } from "@/lib/api";
import { speakText, stopSpeech } from "@/lib/speech";

interface Props {
  selectedPatientId?: string;
  onSelectPatient?: (id: string) => void;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citedSection?: string;
  evidence?: string[];
  recalledMemories?: string[];
  shortTermTurns?: number;
}

// Initial default long-term memories for each patient
const INITIAL_LONG_TERM_MEMORIES: Record<string, string[]> = {
  P001: [
    "Patient preference: Prioritizes conservative therapies and non-invasive interventions before spine surgery.",
    "Historical Imaging: Prior lumbar X-ray in 2024 revealed mild disc space narrowing at L5-S1.",
    "Physiotherapy Compliance: Attended all 16 scheduled sessions (8 weeks) at Apex Physical Therapy without gaps.",
    "Verified active coverage under Horizon Blue Cross PPO with zero prior authorization denials on file.",
  ],
  P002: [
    "Patient history: Axial back pain exacerbated by heavy lifting during residential construction projects.",
    "Clinical Preference: Self-managed with OTC Ibuprofen 400mg; previously declined formal physiotherapy referral.",
    "Care Plan Alert: Patient requires formal counseling on payer-mandated 6-week conservative physiotherapy before MRI approval.",
  ],
  P003: [
    "Eligibility Note: Employer change resulted in policy lapse; UnitedHealthcare coverage terminated on 08/31/2026.",
    "Financial Counseling: Patient referred to clinic benefits coordinator for health insurance exchange enrollment.",
    "Clinical Plan: Physician recommends initiating structured physical therapy immediately once coverage is reinstated.",
  ],
};

function getPatientBriefing(p: SoapPatientRecord): string {
  return `📋 **Physician Clinical Documentation (SOAP Notes) — ${p.name} (${p.id}):**\n\n` +
    `• **[S] Subjective**: ${p.subjective.chief_complaint} (Pain duration: ${p.subjective.pain_duration_weeks} weeks, VAS: ${p.subjective.pain_severity_vas}). ${p.subjective.functional_impact}\n\n` +
    `• **[O] Objective**: ${p.objective.slr_test} Neurological: ${p.objective.neuro_exam} Supervised Physio: ${p.objective.physio_duration_weeks} weeks (${p.objective.physio_attempted ? "Completed" : "None attempted"}).\n\n` +
    `• **[A] Assessment**: ${p.assessment.diagnoses.join("; ")}. Prior Auth Determination: **${p.assessment.recommendation}**${p.assessment.denial_reasons.length > 0 ? " — Denial Reasons: " + p.assessment.denial_reasons.join(". ") : " (All criteria satisfied)"}.\n\n` +
    `• **[P] Plan**: ${p.plan.procedure_requested} (${p.plan.cpt_code}). Orders: ${p.plan.orders.join("; ")}. Rx: ${p.plan.medications.join("; ")}.\n\n` +
    `💡 *Dual Memory Active: Ask any follow-up question below, or click any quick query chip.*`;
}

export default function FloatingRAGAssistant({
  selectedPatientId = "P001",
  onSelectPatient,
}: Props) {
  // OPEN BY DEFAULT so it's immediately visible in the bottom-right corner
  const [isOpen, setIsOpen] = useState(true);
  const [showSoapSummary, setShowSoapSummary] = useState(true);
  const [activeTab, setActiveTab] = useState<"chat" | "memory" | "soap">("chat");
  const [activePatientId, setActivePatientId] = useState(selectedPatientId);
  const [question, setQuestion] = useState("");
  const [isQuerying, setIsQuerying] = useState(false);
  const [isPlayingId, setIsPlayingId] = useState<string | null>(null);
  const [newMemoryText, setNewMemoryText] = useState("");

  // Draggable window coordinates (null = default CSS bottom-right)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const windowRef = useRef<HTMLDivElement>(null);

  // Long-Term Memory (Persistent per patient in localStorage)
  const [patientMemories, setPatientMemories] = useState<Record<string, string[]>>({});

  const patient: SoapPatientRecord =
    SOAP_PATIENTS[activePatientId] || SOAP_PATIENTS["P001"];

  // Short-Term Memory: Initialize with full clinical SOAP briefing so notes appear immediately!
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "initial-briefing",
      role: "assistant",
      content: getPatientBriefing(SOAP_PATIENTS[selectedPatientId] || SOAP_PATIENTS["P001"]),
      citedSection: "SOAP Briefing",
    },
  ]);

  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Sync prop changes and automatically load patient briefing
  useEffect(() => {
    if (selectedPatientId && selectedPatientId !== activePatientId) {
      handlePatientSwitch(selectedPatientId);
    }
  }, [selectedPatientId]);

  // Load persistent memories from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("mriiq_patient_memories");
      if (stored) {
        setPatientMemories(JSON.parse(stored));
      } else {
        setPatientMemories(INITIAL_LONG_TERM_MEMORIES);
        localStorage.setItem("mriiq_patient_memories", JSON.stringify(INITIAL_LONG_TERM_MEMORIES));
      }
    } catch {
      setPatientMemories(INITIAL_LONG_TERM_MEMORIES);
    }
  }, []);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (isOpen && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isOpen, showSoapSummary]);

  const currentMemories = patientMemories[activePatientId] || INITIAL_LONG_TERM_MEMORIES[activePatientId] || [];

  const handlePatientSwitch = (id: string) => {
    setActivePatientId(id);
    onSelectPatient?.(id);
    const targetPatient = SOAP_PATIENTS[id] || SOAP_PATIENTS["P001"];
    setMessages((prev) => [
      ...prev,
      {
        id: `switch-${Date.now()}`,
        role: "assistant",
        content: getPatientBriefing(targetPatient),
        citedSection: "SOAP Briefing",
      },
    ]);
  };

  /* ── Drag & Drop Handlers ────────────────────────────────────────── */
  const handlePointerDown = (e: React.PointerEvent) => {
    // Ignore clicks on buttons/inputs inside the header
    if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest("a") || (e.target as HTMLElement).closest("input")) {
      return;
    }

    const currentRect = windowRef.current?.getBoundingClientRect();
    const currentX = position ? position.x : (currentRect ? currentRect.left : window.innerWidth - 484);
    const currentY = position ? position.y : (currentRect ? currentRect.top : window.innerHeight - 664);

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: currentX,
      startPosY: currentY,
    };
    setIsDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragRef.current) return;
    const deltaX = e.clientX - dragRef.current.startX;
    const deltaY = e.clientY - dragRef.current.startY;

    const windowWidth = 460;
    const windowHeight = 640;
    const maxX = Math.max(10, window.innerWidth - windowWidth);
    const maxY = Math.max(10, window.innerHeight - windowHeight);

    const newX = Math.max(10, Math.min(maxX, dragRef.current.startPosX + deltaX));
    const newY = Math.max(10, Math.min(maxY, dragRef.current.startPosY + deltaY));

    setPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    dragRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const handleResetPosition = () => {
    setPosition(null); // Resets to default bottom-right docked position
  };

  /* ── Memory Handlers ─────────────────────────────────────────────── */
  const handleAddMemory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemoryText.trim()) return;

    const updatedList = [...currentMemories, newMemoryText.trim()];
    const updatedMap = {
      ...patientMemories,
      [activePatientId]: updatedList,
    };

    setPatientMemories(updatedMap);
    try {
      localStorage.setItem("mriiq_patient_memories", JSON.stringify(updatedMap));
    } catch {}

    setNewMemoryText("");
    setMessages((prev) => [
      ...prev,
      {
        id: `mem-${Date.now()}`,
        role: "assistant",
        content: `Added to ${patient.name}'s Long-Term Memory Bank:\n"• ${newMemoryText.trim()}"`,
        citedSection: "Long-Term Memory",
      },
    ]);
  };

  const handleDeleteMemory = (index: number) => {
    const updatedList = currentMemories.filter((_, i) => i !== index);
    const updatedMap = {
      ...patientMemories,
      [activePatientId]: updatedList,
    };
    setPatientMemories(updatedMap);
    try {
      localStorage.setItem("mriiq_patient_memories", JSON.stringify(updatedMap));
    } catch {}
  };

  const handleResetMemories = () => {
    const updatedMap = {
      ...patientMemories,
      [activePatientId]: INITIAL_LONG_TERM_MEMORIES[activePatientId] || [],
    };
    setPatientMemories(updatedMap);
    try {
      localStorage.setItem("mriiq_patient_memories", JSON.stringify(updatedMap));
    } catch {}
  };

  const handleClearShortTermMemory = () => {
    stopSpeech();
    setMessages([
      {
        id: `reset-${Date.now()}`,
        role: "assistant",
        content: `Short-Term conversation memory cleared for this session. Long-Term Memory for ${patient.name} (${currentMemories.length} items) remains intact.`,
        citedSection: "Memory Reset",
      },
    ]);
  };

  /* ── RAG Query Execution ─────────────────────────────────────────── */
  const executeRagQuery = async (queryText: string) => {
    const q = queryText.trim();
    if (!q || isQuerying) return;

    const shortTermHistory = messages
      .filter((m) => !m.id.startsWith("reset-"))
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: q,
    };

    setMessages((prev) => [...prev, userMsg]);
    setQuestion("");
    setIsQuerying(true);

    try {
      const res: RagResponse = await querySoapRag(
        activePatientId,
        q,
        shortTermHistory,
        currentMemories,
      );

      const assistantMsg: ChatMessage = {
        id: `asst-${Date.now()}`,
        role: "assistant",
        content: res.answer,
        citedSection: res.cited_section,
        evidence: res.evidence,
        recalledMemories: res.recalled_long_term_memories,
        shortTermTurns: (res.short_term_turns_count ?? shortTermHistory.length) + 1,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: `Error querying clinical RAG: ${err instanceof Error ? err.message : "Request failed"}`,
        citedSection: "Error",
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsQuerying(false);
    }
  };

  const handleToggleSpeak = (msgId: string, text: string) => {
    if (isPlayingId === msgId) {
      stopSpeech();
      setIsPlayingId(null);
      return;
    }

    speakText(text, {
      onStart: () => setIsPlayingId(msgId),
      onEnd: () => setIsPlayingId(null),
      onError: () => setIsPlayingId(null),
    });
  };

  return (
    <>
      {/* ── Floating Launcher Badge (visible when minimized) ──────── */}
      <div
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 9999,
          display: isOpen ? "none" : "block",
        }}
      >
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "12px 20px",
            borderRadius: "100px",
            background: "linear-gradient(135deg, #0284c7 0%, #6366f1 100%)",
            color: "#ffffff",
            border: "1px solid rgba(255, 255, 255, 0.25)",
            boxShadow: "0 8px 32px rgba(2, 132, 199, 0.55), 0 0 20px rgba(56, 189, 248, 0.4)",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: "0.92rem",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
          id="btn-open-rag-drawer"
          title="Open Draggable Clinical RAG Assistant"
        >
          <span style={{ fontSize: "1.2rem" }}>🩺</span>
          <span>Open Clinical RAG</span>
          <span
            style={{
              padding: "2px 8px",
              borderRadius: "100px",
              background: "rgba(255, 255, 255, 0.2)",
              fontSize: "0.75rem",
              fontWeight: 800,
            }}
          >
            {activePatientId}
          </span>
          <span
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              backgroundColor: "#34d399",
              boxShadow: "0 0 10px #34d399",
            }}
          />
        </button>
      </div>

      {/* ── DRAGGABLE FLOATING RAG ASSISTANT WINDOW ────────────────── */}
      {isOpen && (
        <div
          ref={windowRef}
          style={{
            position: "fixed",
            ...(position
              ? { left: `${position.x}px`, top: `${position.y}px` }
              : { bottom: "24px", right: "24px" }),
            width: "460px",
            maxWidth: "calc(100vw - 32px)",
            height: "640px",
            maxHeight: "calc(100vh - 48px)",
            zIndex: 10000,
            display: "flex",
            flexDirection: "column",
            background: "rgba(10, 14, 23, 0.97)",
            backdropFilter: "blur(24px)",
            border: "1px solid rgba(56, 189, 248, 0.4)",
            borderRadius: "18px",
            boxShadow: "0 24px 64px rgba(0, 0, 0, 0.85), 0 0 45px rgba(56, 189, 248, 0.25)",
            overflow: "hidden",
            transition: isDragging ? "none" : "box-shadow 0.2s ease",
          }}
          id="draggable-rag-window"
        >
          {/* ── DRAGGABLE HEADER (Hold down and drag anywhere!) ─────── */}
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            style={{
              padding: "12px 16px",
              background: "linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)",
              borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: isDragging ? "grabbing" : "grab",
              userSelect: "none",
              touchAction: "none",
            }}
            title="Click, hold down and drag to move RAG Assistant anywhere on the page"
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "30px",
                  height: "30px",
                  borderRadius: "8px",
                  background: "linear-gradient(135deg, var(--accent) 0%, #818cf8 100%)",
                  display: "grid",
                  placeItems: "center",
                  fontSize: "0.95rem",
                  color: "#0f172a",
                  flexShrink: 0,
                }}
              >
                🩺
              </div>
              <div>
                <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "#f8fafc", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>Clinical RAG Assistant</span>
                  <span
                    style={{
                      fontSize: "0.68rem",
                      color: "var(--accent)",
                      background: "rgba(56, 189, 248, 0.15)",
                      padding: "1px 6px",
                      borderRadius: "4px",
                      fontWeight: 600,
                    }}
                  >
                    ⠿ Drag to Move
                  </span>
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                  SOAP Documentation &amp; Dual Memory Engine
                </div>
              </div>
            </div>

            {/* Header action controls */}
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              {position && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: "4px 8px", fontSize: "0.72rem", borderRadius: "6px" }}
                  onClick={handleResetPosition}
                  title="Snap back to bottom-right corner"
                >
                  📍 Reset
                </button>
              )}
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: "4px 8px", fontSize: "0.8rem", borderRadius: "6px" }}
                onClick={() => setIsOpen(false)}
                title="Minimize assistant"
                id="btn-minimize-rag"
              >
                —
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: "4px 8px", fontSize: "0.8rem", borderRadius: "6px" }}
                onClick={() => {
                  stopSpeech();
                  setIsOpen(false);
                }}
                title="Close assistant"
                id="btn-close-rag"
              >
                ✕
              </button>
            </div>
          </div>

          {/* ── PATIENT SELECTOR STRIP ───────────────────────────────── */}
          <div
            style={{
              padding: "8px 14px",
              background: "rgba(15, 23, 42, 0.8)",
              borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
              display: "flex",
              gap: "8px",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
              Active Patient:
            </span>
            {(["P001", "P002", "P003"] as const).map((pid) => (
              <button
                key={pid}
                type="button"
                className={activePatientId === pid ? "btn btn-primary" : "btn btn-ghost"}
                style={{ padding: "3px 10px", fontSize: "0.75rem", borderRadius: "6px" }}
                onClick={() => handlePatientSwitch(pid)}
              >
                {pid}
              </button>
            ))}

            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px" }}>
              <span
                style={{
                  fontSize: "0.7rem",
                  padding: "2px 8px",
                  borderRadius: "100px",
                  background: "rgba(52, 211, 153, 0.15)",
                  color: "var(--approve)",
                  border: "1px solid rgba(52, 211, 153, 0.3)",
                  fontWeight: 600,
                }}
              >
                🧠 {currentMemories.length} Memories
              </span>
            </div>
          </div>

          {/* ── TABS NAVIGATION ─────────────────────────────────────── */}
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              background: "rgba(0, 0, 0, 0.25)",
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab("chat")}
              style={{
                flex: 1,
                padding: "8px",
                border: "none",
                background: activeTab === "chat" ? "rgba(56, 189, 248, 0.12)" : "transparent",
                color: activeTab === "chat" ? "var(--accent)" : "var(--text-secondary)",
                borderBottom: activeTab === "chat" ? "2px solid var(--accent)" : "2px solid transparent",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              💬 Consultation
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("soap")}
              style={{
                flex: 1,
                padding: "8px",
                border: "none",
                background: activeTab === "soap" ? "rgba(52, 211, 153, 0.12)" : "transparent",
                color: activeTab === "soap" ? "var(--approve)" : "var(--text-secondary)",
                borderBottom: activeTab === "soap" ? "2px solid var(--approve)" : "2px solid transparent",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              📄 SOAP Documentation
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("memory")}
              style={{
                flex: 1,
                padding: "8px",
                border: "none",
                background: activeTab === "memory" ? "rgba(129, 140, 248, 0.12)" : "transparent",
                color: activeTab === "memory" ? "#818cf8" : "var(--text-secondary)",
                borderBottom: activeTab === "memory" ? "2px solid #818cf8" : "2px solid transparent",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              🧠 Memory Bank ({currentMemories.length})
            </button>
          </div>

          {/* ── TAB 1: CONSULTATION (CHAT + IMMEDIATE SOAP HIGHLIGHTS) ─ */}
          {activeTab === "chat" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {/* Expandable Instant SOAP Clinical Synopsis Card */}
              <div
                style={{
                  background: "rgba(56, 189, 248, 0.05)",
                  borderBottom: "1px solid rgba(56, 189, 248, 0.2)",
                  padding: "8px 12px",
                  fontSize: "0.78rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                  }}
                  onClick={() => setShowSoapSummary(!showSoapSummary)}
                >
                  <span style={{ fontWeight: 700, color: "var(--accent)" }}>
                    {showSoapSummary ? "▼" : "▶"} {patient.name} ({patient.id}) — SOAP Notes Overview
                  </span>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <span
                      className={`status-badge ${patient.assessment.recommendation === "APPROVE" ? "approve" : "deny"}`}
                      style={{ fontSize: "0.68rem", padding: "1px 6px" }}
                    >
                      {patient.assessment.recommendation}
                    </span>
                    <a
                      href={`/mock-pdfs/${patient.id}.pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-ghost"
                      style={{ fontSize: "0.7rem", padding: "2px 6px" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      PDF ↗
                    </a>
                  </div>
                </div>

                {showSoapSummary && (
                  <div style={{ marginTop: "6px", color: "var(--text-secondary)", lineHeight: 1.45 }}>
                    <div>
                      <strong style={{ color: "#38bdf8" }}>[S]:</strong> {patient.subjective.chief_complaint}
                    </div>
                    <div>
                      <strong style={{ color: "#818cf8" }}>[O]:</strong> {patient.objective.slr_test} • Physio: {patient.objective.physio_duration_weeks}w
                    </div>
                    <div>
                      <strong style={{ color: "var(--approve)" }}>[A]:</strong> {patient.assessment.diagnoses[0]}
                    </div>
                    <div>
                      <strong style={{ color: "var(--warning)" }}>[P]:</strong> {patient.plan.procedure_requested} ({patient.plan.cpt_code})
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Suggestion Chips */}
              <div
                style={{
                  padding: "6px 12px",
                  display: "flex",
                  gap: "6px",
                  overflowX: "auto",
                  whiteSpace: "nowrap",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                  background: "rgba(0, 0, 0, 0.2)",
                }}
              >
                {[
                  "What are the straight leg raise findings?",
                  "Did patient complete 6-week physio?",
                  "What is insurance coverage status?",
                  "Recall long-term clinical memories",
                ].map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="btn btn-ghost"
                    style={{
                      fontSize: "0.72rem",
                      padding: "2px 8px",
                      borderRadius: "100px",
                      flexShrink: 0,
                    }}
                    onClick={() => {
                      setQuestion(chip);
                      executeRagQuery(chip);
                    }}
                    disabled={isQuerying}
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Chat Messages */}
              <div
                ref={chatScrollRef}
                style={{
                  flex: 1,
                  padding: "12px",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
                id="floating-chat-scroll"
              >
                {messages.map((m) => {
                  const isUser = m.role === "user";
                  return (
                    <div
                      key={m.id}
                      style={{
                        alignSelf: isUser ? "flex-end" : "flex-start",
                        maxWidth: "92%",
                        padding: "8px 12px",
                        borderRadius: "12px",
                        background: isUser
                          ? "linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(129, 140, 248, 0.25))"
                          : "rgba(30, 41, 59, 0.8)",
                        border: `1px solid ${isUser ? "rgba(56, 189, 248, 0.4)" : "rgba(255, 255, 255, 0.08)"}`,
                        fontSize: "0.85rem",
                        lineHeight: 1.5,
                        color: "#f1f5f9",
                      }}
                    >
                      {!isUser && m.citedSection && (
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "4px",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "0.68rem",
                              fontWeight: 700,
                              color: "var(--accent)",
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                            }}
                          >
                            [{m.citedSection}]
                          </span>

                          <button
                            type="button"
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: isPlayingId === m.id ? "var(--deny)" : "var(--text-muted)",
                              fontSize: "0.75rem",
                              padding: "2px 4px",
                            }}
                            onClick={() => handleToggleSpeak(m.id, m.content)}
                            title="Listen to response via TTS"
                          >
                            {isPlayingId === m.id ? "⏹ Stop" : "🔊 Listen"}
                          </button>
                        </div>
                      )}

                      <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>

                      {m.evidence && m.evidence.length > 0 && (
                        <div
                          style={{
                            marginTop: "6px",
                            paddingTop: "4px",
                            borderTop: "1px dashed rgba(255, 255, 255, 0.1)",
                            fontSize: "0.72rem",
                            color: "var(--text-muted)",
                          }}
                        >
                          <em>Evidence:</em> {m.evidence.join(" • ")}
                        </div>
                      )}
                    </div>
                  );
                })}

                {isQuerying && (
                  <div
                    style={{
                      alignSelf: "flex-start",
                      padding: "6px 12px",
                      background: "rgba(30, 41, 59, 0.8)",
                      borderRadius: "12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "0.78rem",
                      color: "var(--accent)",
                    }}
                  >
                    <div className="spinner" style={{ width: 12, height: 12 }} />
                    <span>Querying SOAP documentation with dual memory...</span>
                  </div>
                )}
              </div>

              {/* Memory status footer */}
              <div
                style={{
                  padding: "4px 12px",
                  background: "rgba(0, 0, 0, 0.35)",
                  borderTop: "1px solid rgba(255, 255, 255, 0.05)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.7rem",
                  color: "var(--text-muted)",
                }}
              >
                <span>
                  🟢 Short-Term: {messages.filter((m) => m.role === "user").length} turns
                </span>
                <button
                  type="button"
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    fontSize: "0.7rem",
                    textDecoration: "underline",
                  }}
                  onClick={handleClearShortTermMemory}
                >
                  Clear Session History
                </button>
              </div>

              {/* Question Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  executeRagQuery(question);
                }}
                style={{
                  padding: "10px 12px",
                  display: "flex",
                  gap: "8px",
                  background: "rgba(15, 23, 42, 0.9)",
                  borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                }}
              >
                <input
                  type="text"
                  className="form-input"
                  style={{ padding: "8px 12px", fontSize: "0.85rem", flex: 1 }}
                  placeholder={`Ask about ${patient.name}'s SOAP notes...`}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  disabled={isQuerying}
                  id="floating-rag-input"
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: "8px 14px", fontSize: "0.85rem" }}
                  disabled={!question.trim() || isQuerying}
                  id="btn-floating-ask"
                >
                  Ask
                </button>
              </form>
            </div>
          )}

          {/* ── TAB 2: FULL SOAP CLINICAL DOCUMENTATION ─────────────── */}
          {activeTab === "soap" && (
            <div style={{ flex: 1, padding: "14px", overflowY: "auto", fontSize: "0.84rem", lineHeight: 1.55 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div>
                  <div style={{ fontWeight: 700, color: "var(--accent)", fontSize: "0.95rem" }}>
                    {patient.name} ({patient.id})
                  </div>
                  <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                    {patient.clinic} • {patient.provider}
                  </div>
                </div>
                <a
                  href={`/mock-pdfs/${patient.id}.pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost"
                  style={{ fontSize: "0.75rem", padding: "4px 10px" }}
                >
                  📄 View PDF ↗
                </a>
              </div>

              {/* [S] Subjective */}
              <div style={{ marginBottom: "12px", padding: "10px 12px", background: "rgba(56, 189, 248, 0.08)", borderRadius: "8px", border: "1px solid rgba(56, 189, 248, 0.2)" }}>
                <strong style={{ color: "#38bdf8" }}>[S] Subjective:</strong>
                <p style={{ marginTop: "4px" }}>{patient.subjective.hpi}</p>
                <div style={{ display: "flex", gap: "12px", marginTop: "6px", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                  <span>Duration: <strong>{patient.subjective.pain_duration_weeks}w</strong></span>
                  <span>Severity: <strong>{patient.subjective.pain_severity_vas}</strong></span>
                  <span>Impact: <strong>{patient.subjective.functional_impact}</strong></span>
                </div>
              </div>

              {/* [O] Objective */}
              <div style={{ marginBottom: "12px", padding: "10px 12px", background: "rgba(129, 140, 248, 0.08)", borderRadius: "8px", border: "1px solid rgba(129, 140, 248, 0.2)" }}>
                <strong style={{ color: "#818cf8" }}>[O] Objective:</strong>
                <p style={{ marginTop: "4px" }}><strong>Vitals:</strong> {patient.objective.vitals}</p>
                <p style={{ marginTop: "4px" }}><strong>Physical Exam:</strong> {patient.objective.physical_exam}</p>
                <p style={{ marginTop: "4px" }}><strong>Neurological:</strong> {patient.objective.neuro_exam}</p>
                <p style={{ marginTop: "4px" }}><strong>Straight Leg Raise:</strong> {patient.objective.slr_test}</p>
                <div style={{ marginTop: "6px", padding: "6px 8px", background: "rgba(0, 0, 0, 0.2)", borderRadius: "6px" }}>
                  <strong>Physiotherapy Trial: </strong>
                  {patient.objective.physio_attempted
                    ? `Completed ${patient.objective.physio_duration_weeks} weeks.`
                    : "None attempted (0 weeks)."}
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                    {patient.objective.physio_notes}
                  </div>
                </div>
              </div>

              {/* [A] Assessment */}
              <div style={{ marginBottom: "12px", padding: "10px 12px", background: "rgba(52, 211, 153, 0.08)", borderRadius: "8px", border: "1px solid rgba(52, 211, 153, 0.2)" }}>
                <strong style={{ color: "var(--approve)" }}>[A] Assessment:</strong>
                <ul style={{ paddingLeft: "18px", marginTop: "4px" }}>
                  {patient.assessment.diagnoses.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
                <div style={{ marginTop: "8px" }}>
                  <strong>Prior Auth Recommendation: </strong>
                  <span
                    className={`status-badge ${patient.assessment.recommendation === "APPROVE" ? "approve" : "deny"}`}
                    style={{ fontSize: "0.72rem", padding: "2px 8px" }}
                  >
                    {patient.assessment.recommendation}
                  </span>
                </div>
                {patient.assessment.denial_reasons.length > 0 && (
                  <div style={{ marginTop: "6px", fontSize: "0.78rem", color: "var(--deny)" }}>
                    {patient.assessment.denial_reasons.join(". ")}
                  </div>
                )}
              </div>

              {/* [P] Plan */}
              <div style={{ padding: "10px 12px", background: "rgba(251, 191, 36, 0.08)", borderRadius: "8px", border: "1px solid rgba(251, 191, 36, 0.2)" }}>
                <strong style={{ color: "var(--warning)" }}>[P] Plan:</strong>
                <p style={{ marginTop: "4px" }}>
                  <strong>Procedure Requested:</strong> {patient.plan.procedure_requested} (<code>{patient.plan.cpt_code}</code>)
                </p>
                <p style={{ marginTop: "4px" }}>
                  <strong>Orders:</strong> {patient.plan.orders.join("; ")}
                </p>
                <p style={{ marginTop: "4px" }}>
                  <strong>Medications:</strong> {patient.plan.medications.join("; ")}
                </p>
                <p style={{ marginTop: "4px" }}>
                  <strong>Follow-up:</strong> {patient.plan.follow_up}
                </p>
              </div>
            </div>
          )}

          {/* ── TAB 3: LONG-TERM MEMORY BANK ─────────────────────────── */}
          {activeTab === "memory" && (
            <div style={{ flex: 1, padding: "14px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#818cf8" }}>
                    Long-Term Patient Memory Bank
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    Persistent clinical memory across sessions for {patient.name} ({patient.id})
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: "0.72rem", padding: "2px 8px" }}
                  onClick={handleResetMemories}
                >
                  Reset Defaults
                </button>
              </div>

              {/* Memories List */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {currentMemories.map((mem, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "8px",
                      background: "rgba(129, 140, 248, 0.08)",
                      border: "1px solid rgba(129, 140, 248, 0.2)",
                      fontSize: "0.82rem",
                      lineHeight: 1.4,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "8px",
                    }}
                  >
                    <div>
                      <span style={{ color: "#818cf8", fontWeight: 700, marginRight: "6px" }}>
                        #{idx + 1}
                      </span>
                      <span>{mem}</span>
                    </div>
                    <button
                      type="button"
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--deny)",
                        cursor: "pointer",
                        fontSize: "0.75rem",
                        padding: "2px",
                      }}
                      onClick={() => handleDeleteMemory(idx)}
                      title="Delete memory"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {/* Add New Memory Form */}
              <form onSubmit={handleAddMemory} style={{ marginTop: "auto", paddingTop: "10px", borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
                <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
                  + Add Clinician Memory / Preference Note:
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    className="form-input"
                    style={{ padding: "6px 10px", fontSize: "0.82rem", flex: 1 }}
                    placeholder="e.g. Patient experienced prior contrast allergy..."
                    value={newMemoryText}
                    onChange={(e) => setNewMemoryText(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ padding: "6px 12px", fontSize: "0.82rem", whiteSpace: "nowrap" }}
                    disabled={!newMemoryText.trim()}
                  >
                    Save Memory
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </>
  );
}
