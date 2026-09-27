"use client";

import { useState, useEffect } from "react";
import { mockPdfUrl } from "@/lib/api";
import { SOAP_PATIENTS, formatSoapSpeechScript, type SoapPatientRecord } from "@/lib/soapData";
import { speakText, stopSpeech } from "@/lib/speech";

interface Props {
  patientId: string;
}

type SoapSection = "all" | "subjective" | "objective" | "assessment" | "plan";

const SECTIONS: { key: SoapSection; label: string; icon: string; short: string }[] = [
  { key: "all", label: "Full SOAP Note", icon: "📑", short: "Full" },
  { key: "subjective", label: "[S] Subjective", icon: "🗣️", short: "Subjective" },
  { key: "objective", label: "[O] Objective", icon: "🩺", short: "Objective" },
  { key: "assessment", label: "[A] Assessment", icon: "⚖️", short: "Assessment" },
  { key: "plan", label: "[P] Plan", icon: "📋", short: "Plan" },
];

export default function MockPdfViewer({ patientId }: Props) {
  const cleanId = (patientId || "").trim().toUpperCase();
  const patient: SoapPatientRecord | undefined = SOAP_PATIENTS[cleanId];
  const isValid = Boolean(patient);
  const url = mockPdfUrl(cleanId);

  const [activeSection, setActiveSection] = useState<SoapSection>("all");
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingSection, setPlayingSection] = useState<SoapSection | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  // Stop speech playback on component unmount or when patient changes
  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, [cleanId]);

  const handleTogglePlay = (sectionToPlay: SoapSection = activeSection) => {
    setPlaybackError(null);

    // If currently playing the same section -> Stop
    if (isPlaying && playingSection === sectionToPlay) {
      stopSpeech();
      setIsPlaying(false);
      setPlayingSection(null);
      return;
    }

    if (!patient) return;

    const speechScript = formatSoapSpeechScript(patient, sectionToPlay);
    if (!speechScript) return;

    setActiveSection(sectionToPlay);
    setPlayingSection(sectionToPlay);
    setIsPlaying(true);

    speakText(speechScript, {
      onStart: () => {
        setIsPlaying(true);
        setPlayingSection(sectionToPlay);
      },
      onEnd: () => {
        setIsPlaying(false);
        setPlayingSection(null);
      },
      onError: (err) => {
        setIsPlaying(false);
        setPlayingSection(null);
        setPlaybackError(err.message || "Speech playback error");
      },
    });
  };

  const handleSectionSelect = (sectionKey: SoapSection) => {
    setActiveSection(sectionKey);
    // If already playing audio, seamlessly switch narration to the newly selected section
    if (isPlaying) {
      handleTogglePlay(sectionKey);
    }
  };

  if (!isValid) {
    return (
      <div
        style={{
          padding: "24px 20px",
          textAlign: "center",
          color: "var(--text-muted)",
          fontSize: "0.85rem",
          background: "var(--bg-glass)",
          borderRadius: "var(--radius-md)",
          border: "1px dashed var(--border)",
        }}
      >
        📄 Clinical chart PDF is available for preset patient records: <strong>P001</strong>, <strong>P002</strong>, and <strong>P003</strong>.
      </div>
    );
  }

  const selectedSectionObj = SECTIONS.find((s) => s.key === activeSection) || SECTIONS[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* ── AUDIO NARRATION TOOLBAR (OpenAI TTS & Web Speech Fallback) ── */}
      <div
        style={{
          padding: "12px 16px",
          borderRadius: "var(--radius-md)",
          background: isPlaying
            ? "linear-gradient(135deg, rgba(2, 132, 199, 0.12) 0%, rgba(99, 102, 241, 0.12) 100%)"
            : "var(--bg-secondary)",
          border: isPlaying ? "1px solid var(--border-accent)" : "1px solid var(--border)",
          boxShadow: isPlaying ? "0 0 20px rgba(56, 189, 248, 0.15)" : "var(--shadow-sm)",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          transition: "all 0.25s ease",
        }}
      >
        {/* Top Control Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                fontSize: "0.72rem",
                padding: "2px 8px",
                borderRadius: "4px",
                background: "rgba(56, 189, 248, 0.14)",
                color: "var(--accent)",
                fontWeight: 700,
                letterSpacing: "0.03em",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <span>🔊</span>
              <span>OpenAI TTS Scribe</span>
            </span>

            {isPlaying ? (
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div className="audio-equalizer" title="Audio playing">
                  <span className="audio-bar" />
                  <span className="audio-bar" />
                  <span className="audio-bar" />
                  <span className="audio-bar" />
                </div>
                <span
                  style={{
                    fontSize: "0.76rem",
                    color: "var(--accent)",
                    fontWeight: 600,
                  }}
                >
                  Narrating {playingSection === "all" ? "Full SOAP Note" : `[${playingSection?.toUpperCase()}]`} for {patient?.name}...
                </span>
              </div>
            ) : (
              <span style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
                Listen to natural spoken clinical narrative for {patient?.name}
              </span>
            )}
          </div>

          {/* Play / Stop Primary Action Button */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              className={isPlaying ? "btn btn-ghost" : "btn btn-primary"}
              style={{
                padding: "6px 14px",
                fontSize: "0.8rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                borderRadius: "8px",
                fontWeight: 600,
                background: isPlaying ? "rgba(244, 63, 94, 0.12)" : undefined,
                color: isPlaying ? "var(--deny, #ef4444)" : undefined,
                border: isPlaying ? "1px solid rgba(244, 63, 94, 0.35)" : undefined,
              }}
              onClick={() => handleTogglePlay(activeSection)}
              id="btn-play-soap-tts"
              title={
                isPlaying
                  ? "Stop current audio playback"
                  : `Listen to ${selectedSectionObj.label} using OpenAI TTS narration`
              }
            >
              {isPlaying ? (
                <>
                  <span>⏹</span>
                  <span>Stop Narration</span>
                </>
              ) : (
                <>
                  <span>🔊</span>
                  <span>Listen to {selectedSectionObj.short}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Section Pill Selectors */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            flexWrap: "wrap",
            paddingTop: "6px",
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginRight: "4px" }}>
            Section:
          </span>
          {SECTIONS.map((sec) => {
            const isSelected = activeSection === sec.key;
            const isThisPlaying = isPlaying && playingSection === sec.key;

            return (
              <button
                key={sec.key}
                type="button"
                style={{
                  padding: "4px 10px",
                  fontSize: "0.74rem",
                  borderRadius: "6px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontWeight: isSelected ? 700 : 500,
                  background: isThisPlaying
                    ? "rgba(56, 189, 248, 0.22)"
                    : isSelected
                    ? "var(--bg-glass-heavy)"
                    : "transparent",
                  color: isThisPlaying
                    ? "var(--accent)"
                    : isSelected
                    ? "var(--text-primary)"
                    : "var(--text-muted)",
                  border: isThisPlaying
                    ? "1px solid var(--accent)"
                    : isSelected
                    ? "1px solid var(--border-accent)"
                    : "1px solid var(--border)",
                  transition: "all 0.15s ease",
                }}
                onClick={() => handleSectionSelect(sec.key)}
                id={`btn-soap-section-${sec.key}`}
                title={`Select ${sec.label}`}
              >
                <span>{sec.icon}</span>
                <span>{sec.label}</span>
                {isThisPlaying && (
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "var(--accent)",
                      boxShadow: "0 0 6px var(--accent)",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {playbackError && (
          <div
            style={{
              fontSize: "0.72rem",
              color: "var(--deny, #ef4444)",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span>⚠</span>
            <span>{playbackError}</span>
          </div>
        )}
      </div>

      {/* ── PDF EMBED VIEWER ── */}
      <div className="pdf-viewer">
        <iframe
          src={url}
          title={`Synthetic clinical document for ${cleanId}`}
          id="pdf-viewer-frame"
        />
      </div>
    </div>
  );
}
