"use client";

import { useState } from "react";
import { speakText, stopSpeech } from "@/lib/speech";

interface Props {
  recommendation: string;
  denialReasons: string[];
}

export default function TTSPlayer({ recommendation, denialReasons }: Props) {
  const [isPlaying, setIsPlaying] = useState(false);

  const script =
    `The prior authorization recommendation is ${recommendation}. ` +
    (denialReasons.length > 0
      ? `Reasons for denial include: ${denialReasons.join(". ")}.`
      : "All clinical guidelines for lumbar spine MRI have been satisfied.");

  function handleTogglePlay() {
    if (isPlaying) {
      stopSpeech();
      setIsPlaying(false);
      return;
    }

    speakText(script, {
      onStart: () => setIsPlaying(true),
      onEnd: () => setIsPlaying(false),
      onError: () => setIsPlaying(false),
    });
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-icon blue">🔊</div>
        <div>
          <div className="card-title">Audio Recommendation Brief</div>
          <div className="card-subtitle">
            Listen to prior authorization verdict (OpenAI TTS &amp; Universal Audio)
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button
          className={isPlaying ? "btn btn-deny" : "btn btn-ghost"}
          onClick={handleTogglePlay}
          id="btn-play-tts"
        >
          {isPlaying ? "⏹ Stop Audio" : "▶ Listen to Verdict"}
        </button>

        {isPlaying && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="spinner" style={{ width: 18, height: 18 }} />
            <span style={{ color: "var(--accent)", fontSize: "0.85rem", fontWeight: 500 }}>
              Playing audio summary...
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
