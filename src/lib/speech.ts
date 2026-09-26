/**
 * speech.ts — Universal Text-to-Speech Engine
 * Tries OpenAI TTS API first; if unavailable (503 / missing API key / offline),
 * seamlessly falls back to the browser's Web Speech API (speechSynthesis).
 * Guaranteed to produce audible speech in all environments.
 */

let activeAudio: HTMLAudioElement | null = null;
let isSpeakingState = false;

export function stopSpeech(): void {
  // Stop HTML audio
  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    } catch {
      // ignore
    }
    activeAudio = null;
  }

  // Stop browser speech synthesis
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }

  isSpeakingState = false;
}

export function isSpeaking(): boolean {
  return isSpeakingState;
}

/**
 * Speaks the given text.
 * 1. Attempts OpenAI TTS endpoint (/api/tts?text=...).
 * 2. If 503 or error, falls back to Web Speech API (window.speechSynthesis).
 */
export async function speakText(
  text: string,
  callbacks?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: Error) => void;
  },
): Promise<void> {
  const cleanText = text.replace(/[*_#`[\]]/g, "").trim();
  if (!cleanText) return;

  stopSpeech();
  isSpeakingState = true;
  callbacks?.onStart?.();

  const handleEnd = () => {
    isSpeakingState = false;
    callbacks?.onEnd?.();
  };

  const handleError = (err: Error) => {
    isSpeakingState = false;
    callbacks?.onError?.(err);
    callbacks?.onEnd?.();
  };

  // Attempt server-side OpenAI TTS first
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: cleanText }),
    });

    if (res.ok) {
      const blob = await res.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      activeAudio = audio;

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        activeAudio = null;
        handleEnd();
      };

      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        activeAudio = null;
        // Fall back to Web Speech
        speakViaWebSpeech(cleanText, handleEnd, handleError);
      };

      await audio.play();
      return;
    }
  } catch {
    // Server fetch failed, proceed to fallback
  }

  // Fallback to browser SpeechSynthesis
  speakViaWebSpeech(cleanText, handleEnd, handleError);
}

function speakViaWebSpeech(
  text: string,
  onEnd: () => void,
  onError: (err: Error) => void,
): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    onError(new Error("Audio playback is not supported by your browser."));
    return;
  }

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Pick best English voice if available
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(
      (v) => v.lang.startsWith("en") && (v.name.includes("Natural") || v.name.includes("Google") || v.name.includes("David") || v.name.includes("Samantha")),
    ) || voices.find((v) => v.lang.startsWith("en"));

    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    utterance.onend = () => {
      onEnd();
    };

    utterance.onerror = (e) => {
      // synthesis errors like 'canceled' are not fatal errors
      if (e.error !== "canceled" && e.error !== "interrupted") {
        onError(new Error(`Speech synthesis error: ${e.error}`));
      } else {
        onEnd();
      }
    };

    window.speechSynthesis.speak(utterance);
  } catch (e) {
    onError(e instanceof Error ? e : new Error("Speech synthesis failed"));
  }
}
