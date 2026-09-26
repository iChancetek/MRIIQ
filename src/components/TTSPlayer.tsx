"use client";

import { useState, useRef } from "react";
import { fetchTtsAudio } from "@/lib/api";

interface Props {
  recommendation: string;
  denialReasons: string[];
}

export default function TTSPlayer({ recommendation, denialReasons }: Props) {
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const audioRef = useRef<HTMLAudioElement>(null);

  async function handlePlay() {
    if (audioUrl) return; // already fetched
    setLoading(true);
    setError("");
    try {
      const blob = await fetchTtsAudio(recommendation, denialReasons);
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "TTS unavailable");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-icon blue">🔊</div>
        <div>
          <div className="card-title">Audio Summary</div>
          <div className="card-subtitle">
            Listen to the recommendation (OpenAI TTS)
          </div>
        </div>
      </div>

      {!audioUrl && !loading && (
        <button
          className="btn btn-ghost"
          onClick={handlePlay}
          id="btn-play-tts"
        >
          ▶ Generate Audio
        </button>
      )}

      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="spinner" style={{ width: 20, height: 20 }} />
          <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
            Generating speech...
          </span>
        </div>
      )}

      {error && (
        <p style={{ color: "var(--deny)", fontSize: "0.85rem" }}>
          {error}
        </p>
      )}

      {audioUrl && (
        <div className="audio-player">
          <audio ref={audioRef} controls autoPlay src={audioUrl} id="tts-audio">
            Your browser does not support audio playback.
          </audio>
        </div>
      )}
    </div>
  );
}
