import { NextResponse } from "next/server";

// Synthetic patient records
const PATIENTS: Record<string, { patient_id: string; name: string; plan_active: boolean }> = {
  P001: { patient_id: "P001", name: "Alex Morgan", plan_active: true },
  P002: { patient_id: "P002", name: "Jordan Lee", plan_active: true },
  P003: { patient_id: "P003", name: "Casey Kim", plan_active: false },
};

const SYSTEM_PROMPT = `You are a clinical-note extraction assistant.
Your ONLY job is to read the provided clinical note and extract exactly two fields:
  - pain_weeks:   integer or float — how many weeks of back pain are explicitly documented.
  - physio_weeks: integer, float, 0, or null.

Strict rules you MUST follow:
1. Extract ONLY information that is EXPLICITLY written in the note.
2. Never infer, estimate, or invent a value.
3. Never interpret another treatment (massage, chiropractic, acupuncture, etc.) as physiotherapy.
4. If the note says "No physiotherapy was tried" -> physio_weeks = 0.
5. If physiotherapy is mentioned but no duration is given -> physio_weeks = null.
6. If physiotherapy is completely absent from the note -> physio_weeks = null.
7. Convert expressions such as "2 months" to weeks (2 months = 8 weeks).

Respond with a valid JSON object only, no explanation:
{"pain_weeks": <number or null>, "physio_weeks": <number or null>}
`;

// Fallback rule parser in case OpenAI is unavailable
function fallbackExtract(note: string): { pain_weeks: number | null; physio_weeks: number | null } {
  let pain_weeks: number | null = null;
  let physio_weeks: number | null = null;

  const painMatch = note.match(/pain\s+(?:for\s+)?(\d+)\s*weeks?/i);
  if (painMatch) pain_weeks = parseInt(painMatch[1], 10);

  if (/no\s+physiotherapy/i.test(note)) {
    physio_weeks = 0;
  } else {
    const physioMatch = note.match(/physiotherapy\s+(?:for\s+)?(\d+)\s*weeks?/i);
    if (physioMatch) physio_weeks = parseInt(physioMatch[1], 10);
  }

  return { pain_weeks, physio_weeks };
}

export async function POST(req: Request) {
  try {
    const { patient_id, clinical_note } = await req.json();

    const normalizedId = (patient_id || "").trim().toUpperCase();
    const patient = PATIENTS[normalizedId] || {
      patient_id: normalizedId,
      name: `Patient ${normalizedId}`,
      plan_active: false,
    };

    let pain_weeks: number | null = null;
    let physio_weeks: number | null = null;

    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || "gpt-5.6-terra";

    if (apiKey) {
      try {
        const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model,
            max_completion_tokens: 256,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: `Clinical Note:\n${clinical_note}` },
            ],
          }),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const content = aiData.choices?.[0]?.message?.content?.trim();
          if (content) {
            const parsed = JSON.parse(content);
            pain_weeks = parsed.pain_weeks ?? null;
            physio_weeks = parsed.physio_weeks ?? null;
          }
        } else {
          const fallback = fallbackExtract(clinical_note || "");
          pain_weeks = fallback.pain_weeks;
          physio_weeks = fallback.physio_weeks;
        }
      } catch {
        const fallback = fallbackExtract(clinical_note || "");
        pain_weeks = fallback.pain_weeks;
        physio_weeks = fallback.physio_weeks;
      }
    } else {
      const fallback = fallbackExtract(clinical_note || "");
      pain_weeks = fallback.pain_weeks;
      physio_weeks = fallback.physio_weeks;
    }

    // Deterministic Rule Engine
    const min_pain = 6;
    const min_physio = 6;
    const denial_reasons: string[] = [];

    if (!patient.plan_active) {
      denial_reasons.push("Insurance plan is not active.");
    }

    if (pain_weeks === null) {
      denial_reasons.push("Pain duration not explicitly documented in clinical note.");
    } else if (pain_weeks < min_pain) {
      denial_reasons.push(
        `Documented pain duration (${pain_weeks}w) is below the required ${min_pain}-week minimum.`
      );
    }

    if (physio_weeks === null) {
      denial_reasons.push(
        "Physiotherapy duration not explicitly documented or physiotherapy was not attempted."
      );
    } else if (physio_weeks === 0) {
      denial_reasons.push("No physiotherapy was attempted (explicitly stated in clinical note).");
    } else if (physio_weeks < min_physio) {
      denial_reasons.push(
        `Documented physiotherapy duration (${physio_weeks}w) is below the required ${min_physio}-week minimum.`
      );
    }

    const recommendation = denial_reasons.length > 0 ? "DENY" : "APPROVE";
    const thread_id = `auth-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    return NextResponse.json({
      thread_id,
      patient,
      pain_weeks,
      physio_weeks,
      recommendation,
      denial_reasons,
      error: "",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json(
      { error: message, recommendation: "DENY", denial_reasons: [message] },
      { status: 500 }
    );
  }
}
