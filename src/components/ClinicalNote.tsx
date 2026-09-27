"use client";

import { useState, useRef, useEffect } from "react";
import { speakText, stopSpeech } from "@/lib/speech";
import { ClinicalScribe } from "@/lib/scribe";

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export default function ClinicalNote({ value, onChange }: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [scribeError, setScribeError] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const scribeRef = useRef<ClinicalScribe | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    scribeRef.current = new ClinicalScribe();
    return () => {
      scribeRef.current?.cancel();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

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

  const handleToggleScribe = async () => {
    setScribeError(null);

    // If currently recording -> Stop and transcribe via Whisper
    if (isRecording) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setIsRecording(false);
      setIsTranscribing(true);

      try {
        const transcribed = await scribeRef.current?.stopAndTranscribe();
        if (transcribed) {
          const updated = value.trim() ? `${value.trim()} ${transcribed}` : transcribed;
          onChange(updated);
        }
      } catch (err) {
        setScribeError(err instanceof Error ? err.message : "Whisper dictation failed");
      } finally {
        setIsTranscribing(false);
        setRecordingSeconds(0);
      }
      return;
    }

    // Start new dictation session
    try {
      stopSpeech();
      setIsPlaying(false);
      await scribeRef.current?.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      setScribeError(err instanceof Error ? err.message : "Could not access microphone");
      setIsRecording(false);
    }
  };

  return (
    <div className="form-group">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "6px",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <label htmlFor="clinical-note" className="form-label" style={{ marginBottom: 0 }}>
            Physician Clinical Note
          </label>
          <span
            style={{
              fontSize: "0.68rem",
              padding: "1px 6px",
              borderRadius: "4px",
              background: "rgba(2, 132, 199, 0.1)",
              color: "var(--accent)",
              fontWeight: 600,
            }}
          >
            AI Scribe Ready
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {/* ── STT DICTATION (AI Scribe via Whisper) ── */}
          <button
            type="button"
            className="btn btn-ghost"
            style={{
              padding: "4px 10px",
              fontSize: "0.78rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              borderRadius: "6px",
              background: isRecording
                ? "rgba(239, 68, 68, 0.12)"
                : isTranscribing
                ? "rgba(59, 130, 246, 0.12)"
                : undefined,
              border: isRecording ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid var(--border)",
              color: isRecording ? "var(--deny, #ef4444)" : "var(--text-secondary)",
              fontWeight: 600,
            }}
            onClick={handleToggleScribe}
            disabled={isTranscribing}
            title={
              isRecording
                ? "Click to stop recording and transcribe via OpenAI Whisper"
                : "Dictate clinical narrative hands-free with OpenAI Whisper"
            }
            id="btn-scribe-clinical-note"
          >
            {isTranscribing ? (
              <>
                <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
                <span>Transcribing Whisper...</span>
              </>
            ) : isRecording ? (
              <>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#ef4444",
                    boxShadow: "0 0 8px #ef4444",
                  }}
                />
                <span>Stop Dictating ({recordingSeconds}s)</span>
              </>
            ) : (
              <>
                <span>🎙️</span>
                <span>Dictate (AI Scribe)</span>
              </>
            )}
          </button>

          {/* ── TTS NARRATION (OpenAI TTS-1-HD) ── */}
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
              border: "1px solid var(--border)",
            }}
            onClick={handleToggleSpeak}
            disabled={!value.trim() || isRecording}
            title={isPlaying ? "Stop audio playback" : "Listen to clinical note via OpenAI TTS"}
            id="btn-speak-clinical-note"
          >
            {isPlaying ? (
              <>
                <span style={{ color: "var(--deny)" }}>⏹</span>
                <span style={{ color: "var(--deny)" }}>Stop Audio</span>
              </>
            ) : (
              <>
                <span style={{ color: "var(--accent)" }}>🔊</span>
                <span>Listen to Note</span>
              </>
            )}
          </button>
        </div>
      </div>

      {scribeError && (
        <div
          style={{
            fontSize: "0.74rem",
            color: "var(--deny, #ef4444)",
            marginBottom: "6px",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <span>⚠</span>
          <span>{scribeError}</span>
        </div>
      )}

      <textarea
        id="clinical-note"
        className="form-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter clinical note or click 'Dictate (AI Scribe)' to record physician narrative (e.g. 'Back pain for 10 weeks. Supervised physiotherapy completed for 8 weeks.')..."
        rows={5}
      />
    </div>
  );
}
