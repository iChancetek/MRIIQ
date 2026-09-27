/**
 * guardrail.ts — Security, Tenancy, and Scope Guardrails for MRIIQ Clinical RAG.
 *
 * Enforces:
 * 1. Strict 3-Patient Scope Lock (P001 Alex Morgan, P002 Jordan Lee, P003 Casey Kim)
 *    pursuant to HIPAA Access Controls (§ 164.312(a)(1)).
 * 2. Prompt Injection and Jailbreak mitigation.
 * 3. Domain Boundary enforcement (Lumbar Spine MRI Prior Auth & Clinical SOAP notes).
 */

export interface GuardrailCheckResult {
  isAllowed: boolean;
  reason?: string;
  violationType?: "SCOPE" | "INJECTION" | "DOMAIN";
  policyCitation?: string;
}

export const AUTHORIZED_PATIENT_IDS = ["P001", "P002", "P003"] as const;
export type AuthorizedPatientId = (typeof AUTHORIZED_PATIENT_IDS)[number];

export const AUTHORIZED_PATIENTS_META: Record<
  AuthorizedPatientId,
  { name: string; payer: string }
> = {
  P001: { name: "Alex Morgan", payer: "Horizon Blue Cross PPO" },
  P002: { name: "Jordan Lee", payer: "Aetna Choice POS" },
  P003: { name: "Casey Kim", payer: "UnitedHealthcare Choice Plus" },
};

// Injection & Jailbreak Signatures
const JAILBREAK_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /ignore\s+system\s+(prompt|instructions|rules)/i,
  /disregard\s+(all\s+)?(rules|guidelines|instructions)/i,
  /you\s+are\s+now\s+(in\s+)?(developer\s+mode|unrestricted|dan|jailbreak)/i,
  /pretend\s+(you\s+are|to\s+be)\s+(an\s+unrestricted|a\s+hacker|someone\s+without)/i,
  /reveal\s+(your\s+)?(system\s+prompt|hidden\s+instructions|developer\s+prompt)/i,
  /output\s+the\s+text\s+above/i,
  /bypass\s+(the\s+)?(filter|guardrail|security|safety)/i,
  /<script[\s>]/i,
  /javascript:/i,
  /\bexec\s*\(/i,
];

// Disallowed unauthorized patient probes (common mock / unauthorized names or IDs)
const UNAUTHORIZED_PATIENT_PROBES: RegExp[] = [
  /\b(patient\s*[4-9]|p0*0?[4-9]|p[1-9]\d{2,})\b/i,
  /\b(john\s+doe|jane\s+doe|bob\s+smith|alice\s+wonderland)\b/i,
  /\b(hospital\s+ceo|board\s+member|celebrity|vip\s+patient)\b/i,
];

// Relevant clinical domain keywords
const CLINICAL_DOMAIN_KEYWORDS = [
  "patient", "pain", "mri", "spine", "lumbar", "soap", "subjective", "objective",
  "assessment", "plan", "physio", "physical therapy", "therapy", "slr", "straight leg",
  "neuro", "exam", "reflex", "dermatome", "weakness", "vas", "duration", "weeks",
  "icd", "cpt", "72148", "insurance", "payer", "active", "denial", "approval",
  "recommendation", "medication", "meloxicam", "gabapentin", "naproxen", "ibuprofen",
  "radiculopathy", "sciatica", "disc", "herniation", "prior auth", "authorization",
  "order", "dos", "provider", "clinic", "memory", "recall", "history", "record", "note"
];

/**
 * Validates a user clinical inquiry against security, tenancy scope, and domain guardrails.
 */
export function validateRagQuery(
  rawPatientId: string,
  question: string
): GuardrailCheckResult {
  const q = (question || "").trim();

  // 1. Jailbreak / Prompt Injection Defense
  for (const pattern of JAILBREAK_PATTERNS) {
    if (pattern.test(q)) {
      return {
        isAllowed: false,
        reason:
          "Security Guardrail Violation: Adversarial prompt or prompt injection pattern detected. Inquiries must adhere to safe clinical documentation standards.",
        violationType: "INJECTION",
        policyCitation: "NIST AI RMF §2.2 / OWASP LLM01: Prompt Injection Defense",
      };
    }
  }

  // 2. Unauthorized Patient Probe Check
  for (const probe of UNAUTHORIZED_PATIENT_PROBES) {
    if (probe.test(q)) {
      return {
        isAllowed: false,
        reason:
          "Scope Guardrail Violation: Inquiries are strictly restricted to authorized synthetic demo records P001 (Alex Morgan), P002 (Jordan Lee), and P003 (Casey Kim). Access to extraneous or unauthorized patient identifiers is blocked.",
        violationType: "SCOPE",
        policyCitation: "HIPAA Technical Safeguard § 164.312(a)(1) Access Control",
      };
    }
  }

  // 3. Tenancy Scope Check (Patient ID allowlist)
  const normalizedId = rawPatientId.trim().toUpperCase();
  const isAuthorized = AUTHORIZED_PATIENT_IDS.includes(normalizedId as AuthorizedPatientId);

  if (!isAuthorized) {
    return {
      isAllowed: false,
      reason: `Scope Guardrail Violation: Patient ID "${rawPatientId}" is outside the authorized clinical database. The MRIIQ system is strictly scoped to P001 (Alex Morgan), P002 (Jordan Lee), and P003 (Casey Kim).`,
      violationType: "SCOPE",
      policyCitation: "HIPAA Privacy Rule § 164.502 / GDPR Article 5(1)(c) Data Minimization",
    };
  }

  // 4. Domain Boundary Check
  const lowerQ = q.toLowerCase();
  const isDomainRelevant = CLINICAL_DOMAIN_KEYWORDS.some((kw) => lowerQ.includes(kw));

  // If question is longer than 5 words and shares zero overlap with clinical/administrative domain
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length >= 4 && !isDomainRelevant) {
    return {
      isAllowed: false,
      reason:
        "Domain Guardrail Interception: The inquiry appears unrelated to Lumbar Spine MRI Prior Authorization, clinical SOAP notes, or patient clinical criteria. Please direct questions to patient symptoms, physical therapy history, diagnostic criteria, or coverage determinations.",
      violationType: "DOMAIN",
      policyCitation: "FDA Good Machine Learning Practice (GMLP) & Clinical Scoping",
    };
  }

  return {
    isAllowed: true,
  };
}
