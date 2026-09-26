"use client";

import { useState } from "react";
import { speakText, stopSpeech } from "@/lib/speech";

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export default function ClinicalNote({ value, onChange }: Props) {
  const [isPlaying, setIsPlaying] = useState(false);

  const handleToggleSpeak = () => {
    if (isPlaying) {
      stopSpeech();
      setIsPlaying(false);
      return;
    }

    if (!value.trim()) return;

    speakText(value, {
      onStart: () => setIsPlaying(true),
      onEnd: () => setIsPlaying(false),
      onError: () => setIsPlaying(false),
    });
  };

  return (
    <div className="form-group">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
        <label htmlFor="clinical-note" className="form-label" style={{ marginBottom: 0 }}>
          Physician Clinical Note
        </label>
        <button
          type="button"
          className="btn btn-ghost"
          style={{
            padding: "4px 10px",
            fontSize: "0.78rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            borderRadius: "6px",
          }}
          onClick={handleToggleSpeak}
          disabled={!value.trim()}
          title={isPlaying ? "Stop audio playback" : "Listen to clinical note via TTS"}
          id="btn-speak-clinical-note"
        >
          {isPlaying ? (
            <>
              <span style={{ color: "var(--deny)" }}>⏹</span>
              <span>Stop Audio</span>
            </>
          ) : (
            <>
              <span style={{ color: "var(--accent)" }}>🔊</span>
              <span>Listen to Note</span>
            </>
          )}
        </button>
      </div>

      <textarea
        id="clinical-note"
        className="form-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter clinical note... e.g. 'Back pain for 10 weeks. Physiotherapy for 8 weeks.'"
        rows={5}
      />
    </div>
  );
}
