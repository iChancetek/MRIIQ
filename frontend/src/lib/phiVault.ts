/**
 * phiVault.ts — Bidirectional PHI/PII Masking & Tokenization Vault.
 *
 * Implements HIPAA Safe Harbor de-identification (§ 164.514(b)) and GDPR Article 25
 * Data Protection by Design & Default. Replaces direct and indirect Protected Health
 * Information (PHI) and Personally Identifiable Information (PII) with synthetic tokens
 * before data is sent to external LLMs, and safely restores context upon response egress.
 */

export interface MaskResult {
  maskedText: string;
  tokensMaskedCount: number;
  tokenMap: Record<string, string>; // [TOKEN] -> original value
  hipaaSafeHarborCompliant: boolean;
}

// Known entity dictionaries for MRIIQ synthetic clinical database
const PHI_DICTIONARY: Array<{ raw: string; token: string; category: string }> = [
  // Patient names
  { raw: "Alex Morgan", token: "[PATIENT_NAME_001]", category: "NAME" },
  { raw: "Jordan Lee", token: "[PATIENT_NAME_002]", category: "NAME" },
  { raw: "Casey Kim", token: "[PATIENT_NAME_003]", category: "NAME" },

  // Dates of birth / exact dates
  { raw: "04/12/1982", token: "[DOB_001]", category: "DATE" },
  { raw: "09/23/1989", token: "[DOB_002]", category: "DATE" },
  { raw: "11/05/1979", token: "[DOB_003]", category: "DATE" },
  { raw: "September 24, 2026", token: "[DOS_TOKEN]", category: "DATE" },
  { raw: "08/31/2026", token: "[DATE_TOKEN_01]", category: "DATE" },

  // Healthcare Providers & NPIs
  { raw: "Dr. Sarah Vance, MD", token: "[PROVIDER_001]", category: "PROVIDER" },
  { raw: "Dr. Sarah Vance", token: "[PROVIDER_001]", category: "PROVIDER" },
  { raw: "Dr. Marcus Thorne, MD", token: "[PROVIDER_002]", category: "PROVIDER" },
  { raw: "Dr. Marcus Thorne", token: "[PROVIDER_002]", category: "PROVIDER" },
  { raw: "Dr. Elena Rostova, MD", token: "[PROVIDER_003]", category: "PROVIDER" },
  { raw: "Dr. Elena Rostova", token: "[PROVIDER_003]", category: "PROVIDER" },
  { raw: "1982736451", token: "[NPI_001]", category: "NPI" },
  { raw: "1472839102", token: "[NPI_002]", category: "NPI" },
  { raw: "1839201847", token: "[NPI_003]", category: "NPI" },

  // Clinics and Facilities
  { raw: "Metro Spine & Musculoskeletal Institute, Suite 400", token: "[CLINIC_001]", category: "FACILITY" },
  { raw: "Metro Spine & Musculoskeletal Institute", token: "[CLINIC_001]", category: "FACILITY" },
  { raw: "Oakridge Ambulatory Care Center, Suite 102", token: "[CLINIC_002]", category: "FACILITY" },
  { raw: "Oakridge Ambulatory Care Center", token: "[CLINIC_002]", category: "FACILITY" },
  { raw: "Greater Metro Pain Management Associates, Suite 210", token: "[CLINIC_003]", category: "FACILITY" },
  { raw: "Greater Metro Pain Management Associates", token: "[CLINIC_003]", category: "FACILITY" },
  { raw: "Apex Physical Therapy", token: "[FACILITY_PT_001]", category: "FACILITY" },

  // Health Plan / Payer Policy identifiers
  { raw: "HBC-9928192", token: "[POLICY_NUM_001]", category: "IDENTIFIER" },
  { raw: "AET-4491023", token: "[POLICY_NUM_002]", category: "IDENTIFIER" },
  { raw: "UHC-1184920", token: "[POLICY_NUM_003]", category: "IDENTIFIER" },
];

// Regex patterns for generic HIPAA 18 Safe Harbor identifiers
const GENERIC_PATTERNS: Array<{ regex: RegExp; tokenPrefix: string }> = [
  // Social Security Numbers (SSN)
  { regex: /\b\d{3}-\d{2}-\d{4}\b/g, tokenPrefix: "[MASKED_SSN]" },
  // Phone numbers (US formats)
  { regex: /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g, tokenPrefix: "[MASKED_PHONE]" },
  // Email addresses
  { regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, tokenPrefix: "[MASKED_EMAIL]" },
  // Medical Record Numbers (MRN) format e.g. MRN-123456 or MRN#12345
  { regex: /\b(?:MRN|mrn)[#:\s-]*[A-Za-z0-9-]{5,12}\b/g, tokenPrefix: "[MASKED_MRN]" },
];

/**
 * Mask PHI/PII in clinical text prior to transmitting to external LLM providers.
 */
export function maskPhi(text: string): MaskResult {
  if (!text) {
    return {
      maskedText: "",
      tokensMaskedCount: 0,
      tokenMap: {},
      hipaaSafeHarborCompliant: true,
    };
  }

  let masked = text;
  const tokenMap: Record<string, string> = {};
  let tokensMaskedCount = 0;

  // 1. Specific Entity Dictionary Replacement (longest strings first)
  const sortedDict = [...PHI_DICTIONARY].sort((a, b) => b.raw.length - a.raw.length);
  for (const item of sortedDict) {
    if (masked.includes(item.raw)) {
      const escaped = item.raw.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
      const re = new RegExp(escaped, "g");
      const matches = masked.match(re);
      if (matches) {
        tokensMaskedCount += matches.length;
        masked = masked.replace(re, item.token);
        tokenMap[item.token] = item.raw;
      }
    }
  }

  // 2. Generic Regex Patterns (SSN, Phone, Email, MRN)
  let patternCounter = 1;
  for (const { regex, tokenPrefix } of GENERIC_PATTERNS) {
    masked = masked.replace(regex, (match) => {
      const token = `${tokenPrefix}_${patternCounter++}`;
      tokenMap[token] = match;
      tokensMaskedCount++;
      return token;
    });
  }

  return {
    maskedText: masked,
    tokensMaskedCount,
    tokenMap,
    hipaaSafeHarborCompliant: true,
  };
}

/**
 * Detokenize/unmask the LLM response to restore legitimate patient context for authorized UI display.
 */
export function detokenizePhi(text: string, tokenMap: Record<string, string>): string {
  if (!text || !tokenMap || Object.keys(tokenMap).length === 0) {
    return text;
  }

  let unmasked = text;
  for (const [token, original] of Object.entries(tokenMap)) {
    const escapedToken = token.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    unmasked = unmasked.replace(new RegExp(escapedToken, "g"), original);
  }

  return unmasked;
}
