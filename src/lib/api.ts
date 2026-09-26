/**
 * api.ts — Typed API client for the MRI Prior Authorization backend.
 * Uses relative URL "" when running in browser on production (e.g. mriiq.fit),
 * or NEXT_PUBLIC_API_URL when explicitly configured.
 */

function getBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!envUrl || envUrl.includes("api.mriiq.fit")) {
    return "";
  }
  return envUrl.replace(/\/+$/, "");
}

const BASE = getBaseUrl();

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

export interface RagResponse {
  patient_id: string;
  patient_name: string;
  question: string;
  answer: string;
  cited_section: string;
  evidence?: string[];
  recalled_long_term_memories?: string[];
  short_term_turns_count?: number;
  model_used?: string;
  error?: string;
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

export async function querySoapRag(
  patientId: string,
  question: string,
  shortTermHistory?: Array<{ role: string; content: string }>,
  customMemories?: string[],
): Promise<RagResponse> {
  const res = await fetch(`${BASE}/api/rag`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      patient_id: patientId,
      question,
      short_term_history: shortTermHistory,
      custom_memories: customMemories,
    }),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`RAG query failed (${res.status}): ${errorText}`);
  }
  return res.json();
}

export function mockPdfUrl(patientId: string): string {
  return `${BASE}/mock-pdfs/${patientId}.pdf`;
}
