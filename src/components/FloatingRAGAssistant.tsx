"use client";

import { useState, useEffect, useRef } from "react";
import { SOAP_PATIENTS, detectPatientInText, type SoapPatientRecord } from "@/lib/soapData";
import { querySoapRag, type RagResponse } from "@/lib/api";
import { speakText, stopSpeech } from "@/lib/speech";

interface Props {
  selectedPatientId?: string;
  onSelectPatient?: (id: string) => void;
  onClear?: () => void;
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

export default function FloatingRAGAssistant({
  selectedPatientId = "",
  onSelectPatient,
  onClear,
}: Props) {
  // Closed by default per user specification
  const [isOpen, setIsOpen] = useState(false);
  const [activePatientId, setActivePatientId] = useState(selectedPatientId || "");
  const [question, setQuestion] = useState("");
  const [isQuerying, setIsQuerying] = useState(false);
  const [isPlayingId, setIsPlayingId] = useState<string | null>(null);

  // Draggable assistant window coordinates in pixels
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragCoordsRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  }>({ startX: 0, startY: 0, origX: 0, origY: 0 });
  const windowRef = useRef<HTMLDivElement>(null);

  // Collapsed launcher coordinates (allows dragging to ANY position on the platform)
  const [launcherPos, setLauncherPos] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingLauncher, setIsDraggingLauncher] = useState(false);
  const launcherRef = useRef<HTMLDivElement>(null);
  const launcherDragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    hasMoved: boolean;
  }>({ startX: 0, startY: 0, origX: 0, origY: 0, hasMoved: false });

  // Long-Term Memory (Persistent per patient in localStorage)
  const [patientMemories, setPatientMemories] = useState<Record<string, string[]>>({});

  // Active patient record
  const patient: SoapPatientRecord | null =
    activePatientId && SOAP_PATIENTS[activePatientId]
      ? SOAP_PATIENTS[activePatientId]
      : null;

  // Traditional RAG chat messages thread
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Calculate default docked bottom-right position
  const calculateDefaultPosition = () => {
    if (typeof window === "undefined") return { x: 0, y: 0 };
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const width = Math.min(460, winW - 32);
    const height = Math.min(620, winH - 48);
    return {
      x: Math.max(12, winW - width - 24),
      y: Math.max(12, winH - height - 24),
    };
  };

  // Set initial window position and collapsed launcher position on mount
  useEffect(() => {
    setPosition(calculateDefaultPosition());

    if (typeof window !== "undefined") {
      try {
        const savedPos = localStorage.getItem("mriiq_launcher_pos");
        if (savedPos) {
          const parsed = JSON.parse(savedPos);
          if (typeof parsed.x === "number" && typeof parsed.y === "number") {
            setLauncherPos(parsed);
          } else {
            const winW = window.innerWidth;
            const winH = window.innerHeight;
            setLauncherPos({ x: Math.max(16, winW - 230), y: Math.max(16, winH - 76) });
          }
        } else {
          const winW = window.innerWidth;
          const winH = window.innerHeight;
          setLauncherPos({ x: Math.max(16, winW - 230), y: Math.max(16, winH - 76) });
        }
      } catch {
        const winW = window.innerWidth;
        const winH = window.innerHeight;
        setLauncherPos({ x: Math.max(16, winW - 230), y: Math.max(16, winH - 76) });
      }
    }

    const handleResize = () => {
      setPosition((prev) => {
        const winW = window.innerWidth;
        const winH = window.innerHeight;
        const minX = 8;
        const maxX = Math.max(minX, winW - 120);
        const minY = 8;
        const maxY = Math.max(minY, winH - 64);
        return {
          x: Math.min(Math.max(minX, prev.x), maxX),
          y: Math.min(Math.max(minY, prev.y), maxY),
        };
      });

      setLauncherPos((prev) => {
        if (!prev) return null;
        const winW = window.innerWidth;
        const winH = window.innerHeight;
        const pillW = launcherRef.current?.offsetWidth || 210;
        const pillH = launcherRef.current?.offsetHeight || 48;
        return {
          x: Math.min(Math.max(8, prev.x), Math.max(8, winW - pillW - 8)),
          y: Math.min(Math.max(8, prev.y), Math.max(8, winH - pillH - 8)),
        };
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Sync prop changes
  useEffect(() => {
    setActivePatientId(selectedPatientId || "");
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
  }, [messages, isOpen]);


  /* ── Drag & Drop Handlers for Floating Assistant Window ────────────── */
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;

    // Ignore interactive controls inside header
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input") || target.closest("select") || target.closest("a")) {
      return;
    }

    e.preventDefault();
    const currentTarget = e.currentTarget as HTMLElement;
    try {
      currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    setIsDragging(true);
    document.body.style.userSelect = "none";

    const startX = e.clientX;
    const startY = e.clientY;
    const origX = position.x;
    const origY = position.y;
    dragCoordsRef.current = { startX, startY, origX, origY };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      const deltaX = moveEvent.clientX - dragCoordsRef.current.startX;
      const deltaY = moveEvent.clientY - dragCoordsRef.current.startY;

      const winW = window.innerWidth;
      const winH = window.innerHeight;

      // Allow dragging freely across the platform
      const minX = 8;
      const maxX = Math.max(minX, winW - 120);
      const minY = 8;
      const maxY = Math.max(minY, winH - 64);

      const nextX = Math.min(Math.max(minX, dragCoordsRef.current.origX + deltaX), maxX);
      const nextY = Math.min(Math.max(minY, dragCoordsRef.current.origY + deltaY), maxY);

      setPosition({ x: nextX, y: nextY });
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      setIsDragging(false);
      document.body.style.userSelect = "";
      try {
        currentTarget.releasePointerCapture(upEvent.pointerId);
      } catch {}
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  };

  /* ── Drag & Drop Handlers for Collapsed Launcher (Move to ANY position) ── */
  const handleLauncherPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();

    const el = launcherRef.current;
    if (!el) return;

    try {
      el.setPointerCapture(e.pointerId);
    } catch {}

    const rect = el.getBoundingClientRect();
    launcherDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: rect.left,
      origY: rect.top,
      hasMoved: false,
    };

    document.body.style.userSelect = "none";

    const handlePointerMove = (moveEv: PointerEvent) => {
      moveEv.preventDefault();
      const deltaX = moveEv.clientX - launcherDragRef.current.startX;
      const deltaY = moveEv.clientY - launcherDragRef.current.startY;

      if (!launcherDragRef.current.hasMoved && Math.hypot(deltaX, deltaY) > 4) {
        launcherDragRef.current.hasMoved = true;
        setIsDraggingLauncher(true);
      }

      if (launcherDragRef.current.hasMoved) {
        const winW = window.innerWidth;
        const winH = window.innerHeight;
        const pillW = el.offsetWidth || 210;
        const pillH = el.offsetHeight || 48;

        // Allow moving to ANY position on the entire screen
        const minX = 8;
        const maxX = Math.max(minX, winW - pillW - 8);
        const minY = 8;
        const maxY = Math.max(minY, winH - pillH - 8);

        const targetX = Math.min(Math.max(minX, launcherDragRef.current.origX + deltaX), maxX);
        const targetY = Math.min(Math.max(minY, launcherDragRef.current.origY + deltaY), maxY);

        setLauncherPos({ x: targetX, y: targetY });
      }
    };

    const handlePointerUp = (upEv: PointerEvent) => {
      document.body.style.userSelect = "";
      try {
        el.releasePointerCapture(upEv.pointerId);
      } catch {}

      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);

      setIsDraggingLauncher(false);

      if (launcherDragRef.current.hasMoved) {
        // Dropped at new position -> Persist to localStorage
        const deltaX = upEv.clientX - launcherDragRef.current.startX;
        const deltaY = upEv.clientY - launcherDragRef.current.startY;
        const winW = window.innerWidth;
        const winH = window.innerHeight;
        const pillW = el.offsetWidth || 210;
        const pillH = el.offsetHeight || 48;

        const finalX = Math.min(Math.max(8, launcherDragRef.current.origX + deltaX), Math.max(8, winW - pillW - 8));
        const finalY = Math.min(Math.max(8, launcherDragRef.current.origY + deltaY), Math.max(8, winH - pillH - 8));
        const finalPos = { x: finalX, y: finalY };
        setLauncherPos(finalPos);
        try {
          localStorage.setItem("mriiq_launcher_pos", JSON.stringify(finalPos));
        } catch {}
      } else {
        // User clicked without dragging -> Open the traditional RAG assistant!
        setIsOpen(true);
      }
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  };

  const handleResetPosition = () => {
    setPosition(calculateDefaultPosition());
  };

  /* ── Clear Chat History ────────────────────────────────────────────── */
  const handleClearInfo = () => {
    stopSpeech();
    setMessages([]);
    setQuestion("");
    setIsPlayingId(null);
    onClear?.();
  };

  /* ── Traditional RAG Query Execution ───────────────────────────────── */
  const executeRagQuery = async (queryText: string) => {
    const q = queryText.trim();
    if (!q || isQuerying) return;

    // Detect if patient name or ID is mentioned in the query
    const detectedId = detectPatientInText(q);
    let targetPatientId = activePatientId;

    if (detectedId) {
      targetPatientId = detectedId;
      setActivePatientId(detectedId);
      onSelectPatient?.(detectedId);
    }

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: q,
    };

    setMessages((prev) => [...prev, userMsg]);
    setQuestion("");

    // If no patient ID is selected and no patient was mentioned in query
    if (!targetPatientId) {
      const guidanceMsg: ChatMessage = {
        id: `asst-${Date.now()}`,
        role: "assistant",
        content:
          "Please enter a patient ID in the case form or mention the patient's name (e.g., Alex Morgan, Jordan Lee, Casey Kim) in your query to retrieve clinical documentation.",
        citedSection: "Notice",
      };
      setMessages((prev) => [...prev, guidanceMsg]);
      return;
    }

    const shortTermHistory = messages
      .filter((m) => !m.id.startsWith("reset-"))
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));

    setIsQuerying(true);

    try {
      const targetMemories =
        patientMemories[targetPatientId] || INITIAL_LONG_TERM_MEMORIES[targetPatientId] || [];

      const res: RagResponse = await querySoapRag(
        targetPatientId,
        q,
        shortTermHistory,
        targetMemories,
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
      {/* ── COLLAPSED LAUNCHER (Draggable with mouse to ANY position on platform) ── */}
      <div
        ref={launcherRef}
        onPointerDown={handleLauncherPointerDown}
        style={{
          position: "fixed",
          left: launcherPos ? `${launcherPos.x}px` : "calc(100vw - 230px)",
          top: launcherPos ? `${launcherPos.y}px` : "calc(100vh - 76px)",
          zIndex: 9999,
          display: isOpen ? "none" : "flex",
          alignItems: "center",
          gap: "10px",
          padding: "12px 18px",
          borderRadius: "100px",
          background: isDraggingLauncher
            ? "linear-gradient(135deg, #0284c7 0%, #4338ca 100%)"
            : "linear-gradient(135deg, #0284c7 0%, #6366f1 100%)",
          color: "#ffffff",
          border: isDraggingLauncher
            ? "2px solid #38bdf8"
            : "1px solid rgba(255, 255, 255, 0.25)",
          boxShadow: isDraggingLauncher
            ? "0 16px 48px rgba(2, 132, 199, 0.8), 0 0 35px rgba(56, 189, 248, 0.65)"
            : "0 8px 32px rgba(2, 132, 199, 0.55), 0 0 20px rgba(56, 189, 248, 0.4)",
          cursor: isDraggingLauncher ? "grabbing" : "grab",
          fontWeight: 700,
          fontSize: "0.92rem",
          transform: isDraggingLauncher ? "scale(1.06)" : "scale(1)",
          transition: isDraggingLauncher ? "none" : "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s ease",
          userSelect: "none",
          touchAction: "none",
        }}
        id="btn-open-rag-drawer"
        title="Click to open Clinical RAG • Hold & drag anywhere with mouse"
        role="button"
        tabIndex={0}
      >
        <span style={{ fontSize: "1.1rem", opacity: 0.85 }}>⠿</span>
        <span style={{ fontSize: "1.2rem" }}>🩺</span>
        <span>Clinical RAG</span>
        <span
          style={{
            width: "9px",
            height: "9px",
            borderRadius: "50%",
            backgroundColor: "#34d399",
            boxShadow: "0 0 8px #34d399",
          }}
        />
      </div>

      {/* ── TRADITIONAL RAG ASSISTANT WINDOW (Draggable anywhere) ──────── */}
      {isOpen && (
        <div
          ref={windowRef}
          style={{
            position: "fixed",
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: "460px",
            maxWidth: "calc(100vw - 16px)",
            height: "min(620px, calc(100vh - 24px))",
            maxHeight: "calc(100vh - 24px)",
            zIndex: 10000,
            display: "flex",
            flexDirection: "column",
            background: "rgba(10, 14, 23, 0.98)",
            backdropFilter: "blur(24px)",
            border: isDragging ? "2px solid var(--accent)" : "1px solid rgba(56, 189, 248, 0.4)",
            borderRadius: "18px",
            boxShadow: isDragging
              ? "0 36px 90px rgba(0, 0, 0, 0.95), 0 0 60px rgba(56, 189, 248, 0.55)"
              : "0 24px 64px rgba(0, 0, 0, 0.85), 0 0 45px rgba(56, 189, 248, 0.25)",
            overflow: "hidden",
            userSelect: isDragging ? "none" : "auto",
            transition: isDragging ? "none" : "box-shadow 0.2s ease, border-color 0.2s ease",
          }}
          id="draggable-rag-window"
        >
          {/* ── TOP GRIP STRIP ───────────────────────────────────────── */}
          <div
            onPointerDown={handlePointerDown}
            style={{
              height: "22px",
              background: "linear-gradient(180deg, rgba(30, 41, 59, 0.95) 0%, rgba(20, 29, 44, 0.98) 100%)",
              borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: isDragging ? "grabbing" : "grab",
              userSelect: "none",
              touchAction: "none",
              gap: "6px",
            }}
            title="Click and drag with mouse to move the Clinical RAG assistant anywhere on the platform"
          >
            <div
              style={{
                width: "44px",
                height: "4px",
                borderRadius: "4px",
                background: isDragging ? "var(--accent)" : "rgba(255, 255, 255, 0.35)",
                boxShadow: isDragging ? "0 0 8px var(--accent)" : "none",
                transition: "background 0.2s ease, box-shadow 0.2s ease",
              }}
            />
            {isDragging && (
              <span style={{ fontSize: "0.65rem", color: "var(--accent)", fontWeight: 700, letterSpacing: "0.05em" }}>
                MOVING ASSISTANT
              </span>
            )}
          </div>

          {/* ── HEADER ───────────────────────────────────────────────── */}
          <div
            onPointerDown={handlePointerDown}
            style={{
              padding: "10px 14px",
              background: "linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)",
              borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: isDragging ? "grabbing" : "grab",
              userSelect: "none",
              touchAction: "none",
            }}
            title="Click and drag to move window"
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  background: "linear-gradient(135deg, var(--accent) 0%, #818cf8 100%)",
                  display: "grid",
                  placeItems: "center",
                  fontSize: "1.1rem",
                  flexShrink: 0,
                }}
              >
                🩺
              </div>
              <div>
                <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "#f8fafc", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>Clinical RAG Assistant</span>
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                  Grounded in SOAP Clinical Notes
                </div>
              </div>
            </div>

            {/* Header Controls */}
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              {messages.length > 0 && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{
                    padding: "4px 8px",
                    fontSize: "0.72rem",
                    borderRadius: "6px",
                    color: "var(--text-secondary)",
                  }}
                  onClick={handleClearInfo}
                  title="Clear chat messages"
                  id="btn-clear-rag-header"
                >
                  🗑️ Clear
                </button>
              )}
              <button
                type="button"
                className="btn btn-ghost"
                style={{
                  padding: "4px 8px",
                  fontSize: "0.72rem",
                  borderRadius: "6px",
                  color: "var(--accent)",
                }}
                onClick={handleResetPosition}
                title="Dock to bottom-right corner"
                id="btn-dock-rag"
              >
                ↺ Dock
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: "4px 8px", fontSize: "0.8rem", borderRadius: "6px" }}
                onClick={() => setIsOpen(false)}
                title="Minimize / Collapse RAG assistant"
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

          {/* ── ACTIVE CLINICAL CONTEXT ──────────────────────────────── */}
          {patient && (
            <div
              style={{
                padding: "6px 14px",
                background: "rgba(15, 23, 42, 0.85)",
                borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
                fontSize: "0.76rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span>👤</span>
                <span style={{ color: "#f8fafc", fontWeight: 600 }}>{patient.name}</span>
                <span style={{ color: "var(--text-muted)" }}>•</span>
                <span style={{ color: "var(--text-secondary)" }}>{patient.plan_name}</span>
              </div>
              <a
                href={`/mock-pdfs/${patient.id}.pdf`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "var(--accent)",
                  textDecoration: "none",
                  fontSize: "0.72rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "2px",
                }}
                title={`Open original clinical note PDF for ${patient.name}`}
              >
                📄 PDF ↗
              </a>
            </div>
          )}

          {/* ── TRADITIONAL RAG CONVERSATION AREA ─────────────────────── */}
          <div
            ref={chatScrollRef}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px 14px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              background: "rgba(10, 14, 23, 0.6)",
            }}
          >
            {messages.length === 0 ? (
              <div
                style={{
                  margin: "auto",
                  textAlign: "center",
                  maxWidth: "380px",
                  padding: "20px 10px",
                }}
              >
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "12px",
                    background: "linear-gradient(135deg, rgba(56, 189, 248, 0.15) 0%, rgba(129, 140, 248, 0.15) 100%)",
                    border: "1px solid rgba(56, 189, 248, 0.3)",
                    display: "grid",
                    placeItems: "center",
                    fontSize: "1.6rem",
                    margin: "0 auto 12px",
                  }}
                >
                  🩺
                </div>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: "#f8fafc", marginBottom: "6px" }}>
                  Clinical RAG Q&amp;A
                </div>
                <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", lineHeight: 1.5, marginBottom: "16px" }}>
                  {patient
                    ? `Ask questions grounded in clinical documentation for ${patient.name} (${patient.id}).`
                    : "Ask clinical questions about any patient (Alex Morgan, Jordan Lee, Casey Kim)."}
                </p>

                {/* Traditional RAG Prompt Suggestion Chips */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {[
                    patient
                      ? `Display the entire SOAP Note for ${patient.name}`
                      : "Display the entire SOAP Note",
                    "What are the straight leg raise findings?",
                    "Did patient complete 6-week physiotherapy?",
                    "What is insurance coverage status?",
                    "What is the requested procedure and CPT code?",
                  ].map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      style={{
                        padding: "8px 12px",
                        textAlign: "left",
                        fontSize: "0.78rem",
                        color: "var(--text-primary)",
                        background: idx === 0 ? "rgba(56, 189, 248, 0.08)" : "rgba(255, 255, 255, 0.04)",
                        border: idx === 0 ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: "8px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        transition: "all 0.15s ease",
                      }}
                      onClick={() => {
                        setQuestion(chip);
                        executeRagQuery(chip);
                      }}
                      disabled={isQuerying}
                    >
                      <span style={{ color: "var(--accent)" }}>{idx === 0 ? "📄" : "🔍"}</span>
                      <span>{chip}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => {
                const isUser = m.role === "user";
                const isEntireSoap =
                  m.citedSection === "Entire SOAP Note" ||
                  m.content.includes("PHYSICIAN CLINICAL DOCUMENTATION");

                return (
                  <div
                    key={m.id}
                    style={{
                      alignSelf: isUser ? "flex-end" : "flex-start",
                      maxWidth: isEntireSoap ? "96%" : "90%",
                      width: isEntireSoap ? "96%" : "auto",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    {/* Message Bubble */}
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: isUser ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                        background: isUser
                          ? "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)"
                          : "rgba(30, 41, 59, 0.85)",
                        color: "#ffffff",
                        fontSize: "0.83rem",
                        lineHeight: 1.5,
                        border: isUser ? "none" : isEntireSoap ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid rgba(255, 255, 255, 0.09)",
                        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.25)",
                      }}
                    >
                      {/* Assistant Header with section tag and speak button */}
                      {!isUser && (
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "6px",
                            paddingBottom: "4px",
                            borderBottom: "1px solid rgba(255, 255, 255, 0.07)",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "0.68rem",
                              fontWeight: 700,
                              color: isEntireSoap ? "var(--accent)" : "var(--accent)",
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            {isEntireSoap ? "📄 Entire SOAP Clinical Note" : "Clinical RAG Response"}
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
                            title="Listen to response"
                          >
                            {isPlayingId === m.id ? "⏹ Stop" : "🔊 Listen"}
                          </button>
                        </div>
                      )}

                      <div
                        style={{
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          fontFamily: isEntireSoap
                            ? "var(--font-mono, 'Consolas', monospace)"
                            : "inherit",
                          fontSize: isEntireSoap ? "0.76rem" : "0.83rem",
                          lineHeight: 1.55,
                          maxHeight: isEntireSoap ? "380px" : "none",
                          overflowY: isEntireSoap ? "auto" : "visible",
                          padding: isEntireSoap ? "10px 12px" : 0,
                          background: isEntireSoap ? "rgba(10, 14, 23, 0.75)" : "transparent",
                          borderRadius: isEntireSoap ? "8px" : 0,
                          border: isEntireSoap ? "1px solid rgba(56, 189, 248, 0.2)" : "none",
                        }}
                      >
                        {m.content}
                      </div>

                      {/* Traditional RAG Citation / Grounded Evidence Snippet */}
                      {!isUser && (m.evidence?.length || m.citedSection) && (
                        <div
                          style={{
                            marginTop: "8px",
                            paddingTop: "6px",
                            borderTop: "1px dashed rgba(255, 255, 255, 0.12)",
                            fontSize: "0.74rem",
                            color: "var(--text-secondary)",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--accent)", fontWeight: 600, marginBottom: "4px" }}>
                            <span>📎</span>
                            <span>Retrieved Source: [{m.citedSection || "Medical Record"}]</span>
                          </div>
                          {m.evidence && m.evidence.length > 0 && (
                            <div style={{ background: "rgba(0, 0, 0, 0.25)", padding: "6px 8px", borderRadius: "6px", fontStyle: "italic", borderLeft: "2px solid var(--accent)" }}>
                              &ldquo;{m.evidence[0]}&rdquo;
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {isQuerying && (
              <div
                style={{
                  alignSelf: "flex-start",
                  padding: "8px 14px",
                  borderRadius: "12px",
                  background: "rgba(30, 41, 59, 0.7)",
                  color: "var(--text-muted)",
                  fontSize: "0.78rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                <span>Searching clinical notes &amp; retrieving grounded evidence...</span>
              </div>
            )}
          </div>

          {/* ── QUESTION INPUT FORM ─────────────────────────────────── */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              executeRagQuery(question);
            }}
            style={{
              padding: "10px 12px",
              display: "flex",
              gap: "8px",
              background: "rgba(15, 23, 42, 0.95)",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            }}
          >
            <input
              type="text"
              className="form-input"
              style={{ padding: "8px 12px", fontSize: "0.85rem", flex: 1, borderRadius: "8px" }}
              placeholder={
                patient
                  ? `Ask about ${patient.name}'s notes (e.g. SLR, physio, symptoms)...`
                  : "Ask a clinical question (e.g. Alex Morgan SLR findings)..."
              }
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={isQuerying}
              id="floating-rag-input"
            />
            <button
              type="submit"
              className="btn btn-primary"
              style={{ padding: "8px 16px", fontSize: "0.85rem", borderRadius: "8px" }}
              disabled={!question.trim() || isQuerying}
              id="btn-floating-ask"
            >
              Ask
            </button>
          </form>
        </div>
      )}
    </>
  );
}
