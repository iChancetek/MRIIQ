/**
 * scribe.ts — Client-Side AI Clinical Scribe & Universal Speech-to-Text (STT) Engine.
 *
 * 1. Primary Engine: Captures microphone audio using MediaRecorder and transmits
 *    audio to the server-side OpenAI Whisper (whisper-1) endpoint primed with
 *    clinical vocabulary (SOAP notes, CPT 72148, SLR test, radiculopathy).
 * 2. Universal Fallback: If the server returns 503 (e.g. OPENAI_API_KEY not configured)
 *    or is offline, seamlessly falls back to the browser's native Web Speech API
 *    (SpeechRecognition / webkitSpeechRecognition) so voice dictation always works.
 */

export interface ScribeState {
  isRecording: boolean;
  isTranscribing: boolean;
  error: string | null;
}

interface WebSpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      length: number;
      [index: number]: {
        transcript: string;
      };
      isFinal?: boolean;
    };
  };
}

interface WebSpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: WebSpeechRecognitionEvent) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => WebSpeechRecognitionInstance;

export class ClinicalScribe {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private mediaStream: MediaStream | null = null;

  // Browser speech recognition fallback instance
  private recognition: WebSpeechRecognitionInstance | null = null;
  private browserTranscript = "";

  public isRecording = false;

  /**
   * Check if browser environment supports microphone recording.
   */
  public static isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      navigator !== undefined &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === "function" &&
      typeof window.MediaRecorder === "function"
    );
  }

  /**
   * Start recording microphone audio with high quality.
   */
  public async start(): Promise<void> {
    if (!ClinicalScribe.isSupported()) {
      throw new Error("Microphone recording is not supported in this browser.");
    }

    this.audioChunks = [];
    this.browserTranscript = "";

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    // Detect supported MIME type for MediaRecorder
    let mimeType = "audio/webm;codecs=opus";
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      if (MediaRecorder.isTypeSupported("audio/webm")) {
        mimeType = "audio/webm";
      } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
        mimeType = "audio/mp4";
      } else {
        mimeType = "";
      }
    }

    const options = mimeType ? { mimeType } : undefined;
    this.mediaRecorder = new MediaRecorder(this.mediaStream, options);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    // Concurrently start browser Web Speech recognition as resilient fallback
    if (typeof window !== "undefined") {
      const win = window as unknown as {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
      };
      const RecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;

      if (RecognitionClass) {
        try {
          const rec = new RecognitionClass();
          rec.continuous = true;
          rec.interimResults = true;
          rec.lang = "en-US";

          rec.onresult = (e: WebSpeechRecognitionEvent) => {
            let combined = "";
            for (let i = 0; i < e.results.length; i++) {
              const res = e.results[i];
              if (res && res[0]) {
                combined += res[0].transcript + " ";
              }
            }
            this.browserTranscript = combined.trim();
          };

          rec.onerror = () => {
            // Non-fatal: MediaRecorder remains primary
          };

          rec.onend = () => {
            // Keep active while recording if closed prematurely
            if (this.isRecording) {
              try {
                rec.start();
              } catch {}
            }
          };

          rec.start();
          this.recognition = rec;
        } catch {
          this.recognition = null;
        }
      }
    }

    this.mediaRecorder.start(250); // Collect chunk every 250ms
    this.isRecording = true;
  }

  /**
   * Stop recording, package audio blob, and transcribe via OpenAI Whisper endpoint.
   * If the server endpoint returns 503 or fails, seamlessly uses browser recognition fallback.
   */
  public async stopAndTranscribe(): Promise<string> {
    if (!this.mediaRecorder || !this.isRecording) {
      throw new Error("Scribe recorder is not currently active.");
    }

    // Stop browser recognition fallback
    if (this.recognition) {
      try {
        this.recognition.onend = null;
        this.recognition.stop();
      } catch {}
    }

    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        return resolve(this.browserTranscript || "");
      }

      this.mediaRecorder.onstop = async () => {
        this.isRecording = false;

        // Release hardware mic track handles
        if (this.mediaStream) {
          this.mediaStream.getTracks().forEach((track) => track.stop());
          this.mediaStream = null;
        }

        try {
          const mimeType = this.mediaRecorder?.mimeType || "audio/webm";
          const audioBlob = new Blob(this.audioChunks, { type: mimeType });
          this.audioChunks = [];

          // If blob is too small, check browser transcript
          if (audioBlob.size < 500) {
            return resolve(this.browserTranscript || "");
          }

          const ext = mimeType.includes("mp4") ? "mp4" : "webm";
          const formData = new FormData();
          formData.append("audio", audioBlob, `clinical_dictation.${ext}`);

          // Try server-side OpenAI Whisper endpoint first
          try {
            const res = await fetch("/api/stt", {
              method: "POST",
              body: formData,
            });

            if (res.ok) {
              const data = await res.json();
              const whisperText = (data.text || "").trim();
              if (whisperText) {
                return resolve(whisperText);
              }
            } else {
              // Server returned non-200 (e.g. 503 missing API key)
              const errData = await res.json().catch(() => ({}));
              console.warn(
                `[AI Scribe] /api/stt returned ${res.status}: ${errData.error || "unavailable"}. Evaluating client-side fallback.`
              );
            }
          } catch (fetchErr) {
            console.warn("[AI Scribe] /api/stt network fetch failed:", fetchErr);
          }

          // Fallback: If Whisper server is 503 or failed, use browser SpeechRecognition transcript
          if (this.browserTranscript && this.browserTranscript.trim().length > 0) {
            console.info("[AI Scribe] Successfully transcribed speech using browser Web Speech API fallback.");
            return resolve(this.browserTranscript.trim());
          }

          // If both Whisper server and browser transcript produced nothing
          resolve("");
        } catch (err) {
          if (this.browserTranscript) {
            resolve(this.browserTranscript);
          } else {
            reject(err);
          }
        }
      };

      try {
        this.mediaRecorder.stop();
      } catch (e) {
        if (this.browserTranscript) {
          resolve(this.browserTranscript);
        } else {
          reject(e);
        }
      }
    });
  }

  /**
   * Cancel ongoing recording and release microphone streams without transcribing.
   */
  public cancel(): void {
    if (this.recognition) {
      try {
        this.recognition.onend = null;
        this.recognition.abort();
      } catch {}
      this.recognition = null;
    }

    if (this.mediaRecorder && this.isRecording) {
      try {
        this.mediaRecorder.stop();
      } catch {}
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    this.audioChunks = [];
    this.browserTranscript = "";
    this.isRecording = false;
  }
}
