/**
 * api.ts — Typed API client for the MRI Prior Authorization backend.
 * All calls go to NEXT_PUBLIC_API_URL (default http://localhost:8000).
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/* ── Types ───────────────────────────────────────────────────────────────── */

export interface AuthResponse {
  thread_id: string;
  patient: Record<string, unknown>;
  pain_weeks: number | null;
  physio_weeks: number | null;
  recommendation: string;
  denial_reasons: string[];
  error: string;
}

export interface FinalOutcomeResponse {
  final_outcome: string;
}

/* ── API calls ───────────────────────────────────────────────────────────── */

export async function authorize(
  patientId: string,
  clinicalNote: string,
): Promise<AuthResponse> {
  const res = await fetch(`${BASE}/api/authorize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patient_id: patientId, clinical_note: clinicalNote }),
  });
  if (!res.ok) throw new Error(`authorize failed: ${res.status}`);
  return res.json();
}

export async function submitReview(
  patientId: string,
  threadId: string,
  decision: string,
): Promise<FinalOutcomeResponse> {
  const res = await fetch(`${BASE}/api/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      patient_id: patientId,
      thread_id: threadId,
      decision,
    }),
  });
  if (!res.ok) throw new Error(`review failed: ${res.status}`);
  return res.json();
}

export async function fetchTtsAudio(
  recommendation: string,
  denialReasons: string[],
): Promise<Blob> {
  const params = new URLSearchParams({ recommendation });
  denialReasons.forEach((r) => params.append("denial_reasons", r));
  const res = await fetch(`${BASE}/api/tts?${params.toString()}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`tts failed: ${res.status}`);
  return res.blob();
}

export function mockPdfUrl(patientId: string): string {
  return `${BASE}/mock-pdfs/${patientId}.pdf`;
}
