"use client";

import { useState, useEffect, useRef } from "react";
import { SOAP_PATIENTS, type SoapPatientRecord } from "@/lib/soapData";
import { querySoapRag, type RagResponse } from "@/lib/api";
import { speakText, stopSpeech } from "@/lib/speech";

interface Props {
  selectedPatientId?: string;
  onSelectPatient?: (id: string) => void;
}

type SoapTab = "S" | "O" | "A" | "P";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citedSection?: string;
  evidence?: string[];
}

function getPatientSoapBriefing(p: SoapPatientRecord): string {
  return `📋 **Physician Clinical Documentation (SOAP Notes) — ${p.name} (${p.id}):**\n\n` +
    `• **[S] Subjective**: ${p.subjective.chief_complaint}\n` +
    `  - *HPI*: ${p.subjective.hpi}\n` +
    `  - *Pain Duration*: ${p.subjective.pain_duration_weeks} weeks (VAS ${p.subjective.pain_severity_vas})\n` +
    `  - *Functional Limitations*: ${p.subjective.functional_impact}\n\n` +
    `• **[O] Objective**: ${p.objective.vitals}\n` +
    `  - *Physical Exam*: ${p.objective.physical_exam}\n` +
    `  - *Neurological*: ${p.objective.neuro_exam}\n` +
    `  - *Straight Leg Raise (SLR)*: ${p.objective.slr_test}\n` +
    `  - *Supervised Physiotherapy*: ${p.objective.physio_duration_weeks} weeks completed (${p.objective.physio_attempted ? "YES" : "NO"}). ${p.objective.physio_notes}\n\n` +
    `• **[A] Assessment**: ${p.assessment.diagnoses.join("; ")}\n` +
    `  - *Medical Criteria*: Plan Active: ${p.assessment.criteria_plan_active ? "✅" : "❌"} | Pain ≥6w: ${p.assessment.criteria_pain_duration_met ? "✅" : "❌"} | Physio ≥6w: ${p.assessment.criteria_physio_met ? "✅" : "❌"}\n` +
    `  - *Determination*: **${p.assessment.recommendation}**${p.assessment.denial_reasons.length > 0 ? " — Denial Reasons: " + p.assessment.denial_reasons.join(". ") : " (All prior authorization criteria satisfied)"}\n\n` +
    `• **[P] Plan**: Procedure requested: ${p.plan.procedure_requested} (${p.plan.cpt_code})\n` +
    `  - *Orders*: ${p.plan.orders.join("; ")}\n` +
    `  - *Medications*: ${p.plan.medications.join("; ")}\n` +
    `  - *Follow-up*: ${p.plan.follow_up}\n\n` +
    `💡 *Clinical RAG Q&A Assistant ready. Ask any question below to inspect or cross-examine documentation.*`;
}

export default function SOAPRagChat({
  selectedPatientId = "P001",
  onSelectPatient,
}: Props) {
  const [activePatientId, setActivePatientId] = useState(selectedPatientId);
  const [activeTab, setActiveTab] = useState<SoapTab>("S");
  const [question, setQuestion] = useState("");
  const [isQuerying, setIsQuerying] = useState(false);
  const [isPlayingId, setIsPlayingId] = useState<string | null>(null);

  const patient: SoapPatientRecord =
    SOAP_PATIENTS[activePatientId] || SOAP_PATIENTS["P001"];

  // Initialize with immediate full clinical documentation briefing!
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "initial-briefing",
      role: "assistant",
      content: getPatientSoapBriefing(SOAP_PATIENTS[selectedPatientId] || SOAP_PATIENTS["P001"]),
      citedSection: "SOAP Record",
    },
  ]);

  // Sync prop changes
  useEffect(() => {
    if (selectedPatientId && selectedPatientId !== activePatientId) {
      handlePatientChange(selectedPatientId);
    }
  }, [selectedPatientId]);

  const handlePatientChange = (id: string) => {
    setActivePatientId(id);
    onSelectPatient?.(id);
    const targetPatient = SOAP_PATIENTS[id] || SOAP_PATIENTS["P001"];
    setMessages((prev) => [
      ...prev,
      {
        id: `switch-${Date.now()}`,
        role: "assistant",
        content: getPatientSoapBriefing(targetPatient),
        citedSection: "SOAP Record",
      },
    ]);
  };

  const handleQuickQuery = (queryText: string) => {
    setQuestion(queryText);
    executeRagQuery(queryText);
  };

  const executeRagQuery = async (queryText: string) => {
    const q = queryText.trim();
    if (!q || isQuerying) return;

    const userMsgId = `user-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: "user",
      content: q,
    };

    setMessages((prev) => [...prev, userMsg]);
    setQuestion("");
    setIsQuerying(true);

    try {
      const res: RagResponse = await querySoapRag(activePatientId, q);
      const assistantMsg: ChatMessage = {
        id: `asst-${Date.now()}`,
        role: "assistant",
        content: res.answer,
        citedSection: res.cited_section,
        evidence: res.evidence,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: `Failed to query RAG engine: ${err instanceof Error ? err.message : "Unknown error"}`,
        citedSection: "Error",
      };
      setMessages((prev) => [...prev, errorMsg]);
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

  const getSectionTextForSpeech = (): string => {
    if (activeTab === "S") {
      return `Subjective section for ${patient.name}. Chief Complaint: ${patient.subjective.chief_complaint}. History of Present Illness: ${patient.subjective.hpi}. Pain duration: ${patient.subjective.pain_duration_weeks} weeks. Severity: ${patient.subjective.pain_severity_vas}. Functional impact: ${patient.subjective.functional_impact}.`;
    }
    if (activeTab === "O") {
      return `Objective section. Vitals: ${patient.objective.vitals}. Physical exam: ${patient.objective.physical_exam}. Neurological exam: ${patient.objective.neuro_exam}. Straight Leg Raise: ${patient.objective.slr_test}. Physiotherapy trial: ${patient.objective.physio_notes}.`;
    }
    if (activeTab === "A") {
      return `Assessment section. Diagnoses: ${patient.assessment.diagnoses.join(", ")}. Prior authorization recommendation: ${patient.assessment.recommendation}. ${patient.assessment.denial_reasons.join(". ")}`;
    }
    return `Plan section. Requested procedure: ${patient.plan.procedure_requested}, CPT code: ${patient.plan.cpt_code}. Orders: ${patient.plan.orders.join(", ")}. Medications: ${patient.plan.medications.join(", ")}. Follow up: ${patient.plan.follow_up}.`;
  };

  return (
    <div className="card" style={{ marginTop: 28 }} id="soap-rag-section">
      {/* Header */}
      <div className="card-header" style={{ alignItems: "flex-start" }}>
        <div className="card-icon blue">🩺</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div className="card-title">Physician Clinical Documentation (SOAP Notes) &amp; RAG Q&amp;A</div>
              <div className="card-subtitle">
                Synthesized EHR records in SOAP format with grounded clinical query engine
              </div>
            </div>

            <a
              href={`/mock-pdfs/${patient.id}.pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost"
              style={{ fontSize: "0.8rem", padding: "6px 12px" }}
              id="btn-view-soap-pdf"
            >
              📄 View Official SOAP Note PDF ({patient.id}) ↗
            </a>
          </div>
        </div>
      </div>

      {/* Patient Selector Tabs */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "18px" }}>
        {Object.values(SOAP_PATIENTS).map((p) => {
          const isSelected = p.id === activePatientId;
          return (
            <button
              key={p.id}
              type="button"
              className={isSelected ? "btn btn-primary" : "btn btn-ghost"}
              style={{ padding: "6px 14px", fontSize: "0.85rem" }}
              onClick={() => handlePatientChange(p.id)}
            >
              <strong>{p.id}</strong> — {p.name}
            </button>
          );
        })}
      </div>

      {/* Patient Metadata Bar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "10px",
          background: "var(--bg-glass)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)",
          padding: "12px 16px",
          marginBottom: "18px",
          fontSize: "0.82rem",
        }}
      >
        <div>
          <span style={{ color: "var(--text-muted)" }}>Patient: </span>
          <strong>{patient.name}</strong> ({patient.gender}, {patient.dob})
        </div>
        <div>
          <span style={{ color: "var(--text-muted)" }}>Insurance Plan: </span>
          <span
            style={{
              color: patient.assessment.criteria_plan_active ? "var(--approve)" : "var(--deny)",
              fontWeight: 600,
            }}
          >
            {patient.plan_name} ({patient.plan_status})
          </span>
        </div>
        <div>
          <span style={{ color: "var(--text-muted)" }}>Attending Provider: </span>
          <span>{patient.provider}</span>
        </div>
        <div>
          <span style={{ color: "var(--text-muted)" }}>Date of Service: </span>
          <span>{patient.dos}</span>
        </div>
      </div>

      {/* SOAP Section Tabs */}
      <div style={{ display: "flex", gap: "6px", borderBottom: "1px solid var(--border)", marginBottom: "14px" }}>
        {[
          { tab: "S" as SoapTab, label: "[S] Subjective", color: "#38bdf8" },
          { tab: "O" as SoapTab, label: "[O] Objective", color: "#818cf8" },
          { tab: "A" as SoapTab, label: "[A] Assessment", color: "#34d399" },
          { tab: "P" as SoapTab, label: "[P] Plan", color: "#fbbf24" },
        ].map((item) => {
          const isActive = activeTab === item.tab;
          return (
            <button
              key={item.tab}
              type="button"
              onClick={() => setActiveTab(item.tab)}
              style={{
                background: isActive ? "rgba(255, 255, 255, 0.08)" : "transparent",
                color: isActive ? item.color : "var(--text-secondary)",
                border: "none",
                borderBottom: isActive ? `2px solid ${item.color}` : "2px solid transparent",
                padding: "8px 14px",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all var(--transition-fast)",
              }}
            >
              {item.label}
            </button>
          );
        })}

        <button
          type="button"
          className="btn btn-ghost"
          style={{
            marginLeft: "auto",
            padding: "4px 10px",
            fontSize: "0.78rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
          }}
          onClick={() => handleToggleSpeak(`tab-${activeTab}`, getSectionTextForSpeech())}
          title="Listen to this SOAP section"
        >
          {isPlayingId === `tab-${activeTab}` ? (
            <>
              <span style={{ color: "var(--deny)" }}>⏹</span>
              <span>Stop Audio</span>
            </>
          ) : (
            <>
              <span style={{ color: "var(--accent)" }}>🔊</span>
              <span>Listen to Section</span>
            </>
          )}
        </button>
      </div>

      {/* Tab Content Display */}
      <div
        style={{
          background: "var(--bg-glass)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          padding: "16px 20px",
          marginBottom: "24px",
          fontSize: "0.9rem",
          lineHeight: 1.6,
        }}
      >
        {activeTab === "S" && (
          <div>
            <div style={{ fontWeight: 600, color: "var(--accent)", marginBottom: "6px" }}>
              Chief Complaint &amp; History of Present Illness (HPI)
            </div>
            <p style={{ marginBottom: "12px" }}>
              <strong>Chief Complaint:</strong> {patient.subjective.chief_complaint}
            </p>
            <p style={{ marginBottom: "12px", color: "var(--text-secondary)" }}>
              {patient.subjective.hpi}
            </p>
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "0.85rem" }}>
              <div>
                <span style={{ color: "var(--text-muted)" }}>Pain Duration: </span>
                <strong>{patient.subjective.pain_duration_weeks} weeks</strong>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }}>VAS Severity: </span>
                <strong>{patient.subjective.pain_severity_vas}</strong>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }}>Functional Impact: </span>
                <span>{patient.subjective.functional_impact}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "O" && (
          <div>
            <div style={{ fontWeight: 600, color: "#818cf8", marginBottom: "6px" }}>
              Physical Examination &amp; Objective Findings
            </div>
            <p style={{ marginBottom: "8px" }}>
              <strong>Vitals:</strong> {patient.objective.vitals}
            </p>
            <p style={{ marginBottom: "8px" }}>
              <strong>Physical Exam:</strong> {patient.objective.physical_exam}
            </p>
            <p style={{ marginBottom: "8px" }}>
              <strong>Neurological Evaluation:</strong> {patient.objective.neuro_exam}
            </p>
            <p style={{ marginBottom: "8px" }}>
              <strong>Straight Leg Raise (SLR):</strong> {patient.objective.slr_test}
            </p>
            <div
              style={{
                marginTop: "10px",
                padding: "10px 14px",
                background: patient.objective.physio_attempted
                  ? "rgba(52, 211, 153, 0.08)"
                  : "rgba(248, 113, 113, 0.08)",
                border: `1px solid ${patient.objective.physio_attempted ? "rgba(52, 211, 153, 0.2)" : "rgba(248, 113, 113, 0.2)"}`,
                borderRadius: "var(--radius-sm)",
              }}
            >
              <strong>Supervised Physiotherapy: </strong>
              {patient.objective.physio_attempted
                ? `Completed ${patient.objective.physio_duration_weeks} weeks.`
                : "None attempted (0 weeks)."}
              <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                {patient.objective.physio_notes}
              </div>
            </div>
          </div>
        )}

        {activeTab === "A" && (
          <div>
            <div style={{ fontWeight: 600, color: "var(--approve)", marginBottom: "6px" }}>
              Clinical Assessment &amp; Authorization Criteria Checklist
            </div>
            <div style={{ marginBottom: "10px" }}>
              <strong>Diagnoses:</strong>
              <ul style={{ paddingLeft: "20px", marginTop: "4px" }}>
                {patient.assessment.diagnoses.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "8px",
                marginTop: "12px",
                padding: "12px",
                background: "rgba(255, 255, 255, 0.03)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <div>
                Active Health Plan:{" "}
                {patient.assessment.criteria_plan_active ? "✅ Satisfied" : "❌ Not Met"}
              </div>
              <div>
                Pain Duration ≥ 6 Weeks:{" "}
                {patient.assessment.criteria_pain_duration_met ? "✅ Satisfied" : "❌ Not Met"}
              </div>
              <div>
                Physiotherapy ≥ 6 Weeks:{" "}
                {patient.assessment.criteria_physio_met ? "✅ Satisfied" : "❌ Not Met"}
              </div>
            </div>

            <div style={{ marginTop: "12px" }}>
              <strong>Prior Auth Determination: </strong>
              <span
                className={`status-badge ${patient.assessment.recommendation === "APPROVE" ? "approve" : "deny"}`}
              >
                ● {patient.assessment.recommendation}
              </span>
            </div>

            {patient.assessment.denial_reasons.length > 0 && (
              <div style={{ marginTop: "8px" }}>
                <span style={{ color: "var(--deny)", fontWeight: 600, fontSize: "0.85rem" }}>
                  Denial Rationale:
                </span>
                <ul style={{ paddingLeft: "20px", marginTop: "4px", fontSize: "0.85rem" }}>
                  {patient.assessment.denial_reasons.map((r, i) => (
                    <li key={i} style={{ color: "var(--text-secondary)" }}>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {activeTab === "P" && (
          <div>
            <div style={{ fontWeight: 600, color: "var(--warning)", marginBottom: "6px" }}>
              Plan of Care &amp; Clinical Orders
            </div>
            <p style={{ marginBottom: "8px" }}>
              <strong>Requested Procedure:</strong> {patient.plan.procedure_requested} (
              <code>{patient.plan.cpt_code}</code>)
            </p>
            <p style={{ marginBottom: "8px" }}>
              <strong>Clinical Orders:</strong> {patient.plan.orders.join("; ")}
            </p>
            <p style={{ marginBottom: "8px" }}>
              <strong>Prescribed Medications:</strong> {patient.plan.medications.join("; ")}
            </p>
            <p>
              <strong>Follow-up Instructions:</strong> {patient.plan.follow_up}
            </p>
          </div>
        )}
      </div>

      {/* ── Clinical RAG Assistant Q&A ──────────────────────────────── */}
      <div
        style={{
          borderTop: "1px solid var(--border)",
          paddingTop: "20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: "1.2rem" }}>💬</span>
          <div>
            <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-primary)" }}>
              Clinical RAG Assistant — Query Physician Documentation
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
              Ask clinical questions about {patient.name} ({patient.id}) grounded in SOAP notes
            </div>
          </div>
        </div>

        {/* Suggestion Chips */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            marginBottom: "14px",
          }}
        >
          {[
            "What are the straight leg raise and neurological findings?",
            "Did the patient complete the 6-week physiotherapy requirement?",
            "What is the insurance plan status and coverage eligibility?",
            "What are the ICD-10 diagnoses and requested CPT code?",
          ].map((chipText, i) => (
            <button
              key={i}
              type="button"
              className="btn btn-ghost"
              style={{
                fontSize: "0.75rem",
                padding: "4px 10px",
                borderRadius: "100px",
              }}
              onClick={() => handleQuickQuery(chipText)}
              disabled={isQuerying}
            >
              {chipText}
            </button>
          ))}
        </div>

        {/* Chat Messages */}
        <div
          style={{
            maxHeight: "360px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            padding: "12px",
            background: "rgba(0, 0, 0, 0.25)",
            borderRadius: "var(--radius-md)",
            marginBottom: "14px",
          }}
          id="rag-chat-messages"
        >
          {messages.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={msg.id}
                style={{
                  alignSelf: isUser ? "flex-end" : "flex-start",
                  maxWidth: "90%",
                  background: isUser ? "linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(129, 140, 248, 0.2))" : "var(--bg-card)",
                  border: `1px solid ${isUser ? "var(--border-accent)" : "var(--border)"}`,
                  borderRadius: "var(--radius-md)",
                  padding: "10px 14px",
                  fontSize: "0.88rem",
                  lineHeight: 1.5,
                }}
              >
                {!isUser && msg.citedSection && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "6px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: "100px",
                        background: "var(--accent-soft)",
                        color: "var(--accent)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      SOAP Section: {msg.citedSection}
                    </span>

                    <button
                      type="button"
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: isPlayingId === msg.id ? "var(--deny)" : "var(--text-muted)",
                        fontSize: "0.8rem",
                        padding: "2px 6px",
                      }}
                      onClick={() => handleToggleSpeak(msg.id, msg.content)}
                      title="Listen to response"
                    >
                      {isPlayingId === msg.id ? "⏹ Stop" : "🔊 Listen"}
                    </button>
                  </div>
                )}

                <div style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>

                {msg.evidence && msg.evidence.length > 0 && (
                  <div
                    style={{
                      marginTop: "8px",
                      paddingTop: "6px",
                      borderTop: "1px dashed var(--border)",
                      fontSize: "0.78rem",
                      color: "var(--text-muted)",
                    }}
                  >
                    <em>Evidence:</em> {msg.evidence.join(" • ")}
                  </div>
                )}
              </div>
            );
          })}

          {isQuerying && (
            <div
              style={{
                alignSelf: "flex-start",
                padding: "8px 14px",
                background: "var(--bg-card)",
                borderRadius: "var(--radius-md)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "0.82rem",
                color: "var(--accent)",
              }}
            >
              <div className="spinner" style={{ width: 14, height: 14 }} />
              <span>Querying SOAP documentation...</span>
            </div>
          )}
        </div>

        {/* Input box */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            executeRagQuery(question);
          }}
          style={{ display: "flex", gap: "10px" }}
        >
          <input
            type="text"
            className="form-input"
            style={{ flex: 1, padding: "10px 14px", fontSize: "0.9rem" }}
            placeholder={`Ask a question about ${patient.name}'s SOAP note (e.g. SLR, physio trial, CPT code)...`}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={isQuerying}
            id="rag-question-input"
          />
          <button
            type="submit"
            className="btn btn-primary"
            style={{ padding: "10px 18px", whiteSpace: "nowrap" }}
            disabled={!question.trim() || isQuerying}
            id="btn-submit-rag"
          >
            {isQuerying ? "Searching..." : "🔍 Ask RAG"}
          </button>
        </form>
      </div>
    </div>
  );
}
