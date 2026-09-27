/**
 * scribe.ts — Client-Side AI Clinical Scribe & Speech-to-Text (STT) Engine.
 *
 * Captures microphone audio using MediaRecorder and transmits high-fidelity audio
 * blobs to the server-side OpenAI Whisper (whisper-1) transcription endpoint.
 * Primed with clinical domain vocabulary (SOAP notes, CPT 72148, SLR, etc.).
 */

export interface ScribeState {
  isRecording: boolean;
  isTranscribing: boolean;
  error: string | null;
}

export class ClinicalScribe {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private mediaStream: MediaStream | null = null;

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
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    // Detect supported MIME type
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

    this.mediaRecorder.start(250); // Collect chunk every 250ms
    this.isRecording = true;
  }

  /**
   * Stop recording, package audio blob, and transcribe via OpenAI Whisper endpoint.
   */
  public async stopAndTranscribe(): Promise<string> {
    if (!this.mediaRecorder || !this.isRecording) {
      throw new Error("Scribe recorder is not currently active.");
    }

    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        return reject(new Error("MediaRecorder uninitialized"));
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

          if (audioBlob.size < 500) {
            return resolve(""); // Audio snippet too short/silent
          }

          const ext = mimeType.includes("mp4") ? "mp4" : "webm";
          const formData = new FormData();
          formData.append("audio", audioBlob, `clinical_dictation.${ext}`);

          const res = await fetch("/api/stt", {
            method: "POST",
            body: formData,
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Whisper transcription failed with status ${res.status}`);
          }

          const data = await res.json();
          resolve(data.text ? data.text.trim() : "");
        } catch (err) {
          reject(err);
        }
      };

      try {
        this.mediaRecorder.stop();
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * Cancel ongoing recording and release microphone streams without transcribing.
   */
  public cancel(): void {
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
    this.isRecording = false;
  }
}
