import { NextResponse } from "next/server";
import { SOAP_PATIENTS, type SoapPatientRecord } from "@/lib/soapData";

function normalizePatientId(id: string): string {
  const clean = (id || "P001").trim().toUpperCase();
  // Handle typo POO1 -> P001
  if (clean === "POO1" || clean === "P01") return "P001";
  if (clean === "POO2" || clean === "P02") return "P002";
  if (clean === "POO3" || clean === "P03") return "P003";
  return clean;
}

function getFallbackAnswer(patient: SoapPatientRecord, question: string) {
  const q = question.toLowerCase();

  // Straight leg raise / SLR
  if (q.includes("slr") || q.includes("straight leg") || q.includes("raise")) {
    return {
      cited_section: "Objective",
      answer: `According to the Objective physical examination: ${patient.objective.slr_test} Neurological evaluation: ${patient.objective.neuro_exam}`,
      evidence: [patient.objective.slr_test, patient.objective.neuro_exam],
    };
  }

  // Physical therapy / physio / rehabilitation
  if (q.includes("physio") || q.includes("physical therapy") || q.includes("rehab") || q.includes("exercise") || q.includes("conservative")) {
    return {
      cited_section: "Objective",
      answer: `Objective record regarding conservative therapy: ${patient.objective.physio_notes} Completed duration: ${patient.objective.physio_duration_weeks} weeks (Trial completed: ${patient.objective.physio_attempted ? "YES" : "NO"}). Guideline criteria met: ${patient.assessment.criteria_physio_met ? "YES" : "NO"}.`,
      evidence: [patient.objective.physio_notes, `Physio weeks: ${patient.objective.physio_duration_weeks}`],
    };
  }

  // Pain / duration / HPI / onset
  if (q.includes("pain") || q.includes("duration") || q.includes("week") || q.includes("vas") || q.includes("onset") || q.includes("hpi")) {
    return {
      cited_section: "Subjective",
      answer: `Subjective documentation notes: Chief Complaint: "${patient.subjective.chief_complaint}". Pain duration: ${patient.subjective.pain_duration_weeks} weeks. VAS Severity: ${patient.subjective.pain_severity_vas}. Functional Impact: ${patient.subjective.functional_impact}`,
      evidence: [patient.subjective.hpi, `Pain duration: ${patient.subjective.pain_duration_weeks} weeks`],
    };
  }

  // Insurance / plan / active / coverage / payer
  if (q.includes("insurance") || q.includes("plan") || q.includes("active") || q.includes("coverage") || q.includes("payer")) {
    return {
      cited_section: "Assessment",
      answer: `Insurance status: ${patient.plan_name} is currently ${patient.plan_status}. Active plan criteria satisfied: ${patient.assessment.criteria_plan_active ? "YES" : "NO"}.`,
      evidence: [`Plan: ${patient.plan_name}`, `Status: ${patient.plan_status}`],
    };
  }

  // Diagnosis / ICD / assessment
  if (q.includes("diagnos") || q.includes("icd") || q.includes("assessment") || q.includes("condition")) {
    return {
      cited_section: "Assessment",
      answer: `Clinical Assessment Diagnoses: ${patient.assessment.diagnoses.join("; ")}. Prior Authorization Determination: ${patient.assessment.recommendation}.`,
      evidence: patient.assessment.diagnoses,
    };
  }

  // Procedure / CPT / MRI / order / plan
  if (q.includes("procedure") || q.includes("cpt") || q.includes("mri") || q.includes("order") || q.includes("medication") || q.includes("rx")) {
    return {
      cited_section: "Plan",
      answer: `Physician Plan: Procedure requested: ${patient.plan.procedure_requested} (${patient.plan.cpt_code}). Orders: ${patient.plan.orders.join("; ")}. Medications: ${patient.plan.medications.join("; ")}. Follow-up: ${patient.plan.follow_up}`,
      evidence: [patient.plan.procedure_requested, patient.plan.cpt_code, ...patient.plan.medications],
    };
  }

  // Default overview
  return {
    cited_section: "SOAP Record",
    answer: patient.full_summary,
    evidence: [
      `Subjective: ${patient.subjective.chief_complaint}`,
      `Objective: ${patient.objective.physical_exam}`,
      `Assessment: Recommendation ${patient.assessment.recommendation}`,
      `Plan: ${patient.plan.procedure_requested}`,
    ],
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawPatientId = body.patient_id || "P001";
    const patientId = normalizePatientId(rawPatientId);
    const question = (body.question || "").trim();

    if (!question) {
      return NextResponse.json({ error: "Question is required" }, { status: 400 });
    }

    const patient = SOAP_PATIENTS[patientId] || SOAP_PATIENTS["P001"];

    const clinicalContext = `
PATIENT RECORD:
ID: ${patient.id}
Name: ${patient.name} | DOB: ${patient.dob} | Gender: ${patient.gender}
Payer: ${patient.plan_name} (Status: ${patient.plan_status})
Date of Service: ${patient.dos}
Provider: ${patient.provider} | Clinic: ${patient.clinic}

[S] SUBJECTIVE:
- Chief Complaint: ${patient.subjective.chief_complaint}
- History of Present Illness: ${patient.subjective.hpi}
- Pain Duration: ${patient.subjective.pain_duration_weeks} weeks
- Pain Severity (VAS): ${patient.subjective.pain_severity_vas}
- Functional Impact: ${patient.subjective.functional_impact}

[O] OBJECTIVE:
- Vitals: ${patient.objective.vitals}
- Physical Examination: ${patient.objective.physical_exam}
- Neurological Examination: ${patient.objective.neuro_exam}
- Straight Leg Raise (SLR): ${patient.objective.slr_test}
- Supervised Physiotherapy Trial: ${patient.objective.physio_attempted ? "YES" : "NO"} (${patient.objective.physio_duration_weeks} weeks completed)
- Physiotherapy Details: ${patient.objective.physio_notes}

[A] ASSESSMENT:
- Diagnoses: ${patient.assessment.diagnoses.join(", ")}
- Active Plan Criteria Met: ${patient.assessment.criteria_plan_active ? "YES" : "NO"}
- Pain Duration Criteria Met (≥6 weeks): ${patient.assessment.criteria_pain_duration_met ? "YES" : "NO"}
- Physiotherapy Criteria Met (≥6 weeks): ${patient.assessment.criteria_physio_met ? "YES" : "NO"}
- Prior Auth Recommendation: ${patient.assessment.recommendation}
${patient.assessment.denial_reasons.length > 0 ? `- Denial Reasons: ${patient.assessment.denial_reasons.join("; ")}` : "- All criteria met."}

[P] PLAN:
- Procedure Requested: ${patient.plan.procedure_requested} (${patient.plan.cpt_code})
- Clinical Orders: ${patient.plan.orders.join("; ")}
- Prescribed Medications: ${patient.plan.medications.join("; ")}
- Follow-up: ${patient.plan.follow_up}
`;

    const apiKey = process.env.OPENAI_API_KEY;

    // If OpenAI is available, query gpt-5.6-terra with strict clinical grounding
    if (apiKey) {
      try {
        const model = process.env.OPENAI_MODEL || "gpt-5.6-terra";
        const prompt = `You are an expert clinical documentation and prior authorization auditor answering questions about a patient's Physician Clinical Documentation in SOAP Notes format.

CLINICAL DOCUMENTATION (SOAP RECORD):
${clinicalContext}

USER QUESTION:
${question}

INSTRUCTIONS:
1. Answer the question accurately and concisely using ONLY the provided SOAP documentation above.
2. Structure your answer using the relevant SOAP section tag ([Subjective], [Objective], [Assessment], or [Plan]).
3. Provide the exact clinical details (e.g. durations, exams, test findings, criteria status, codes).
4. Do not invent or assume any clinical information not found in the note.`;

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model,
            messages: [
              {
                role: "system",
                content:
                  "You are a clinical physician assistant for MRI Prior Authorization auditing.",
              },
              { role: "user", content: prompt },
            ],
            temperature: 0.1,
          }),
        });

        if (response.ok) {
          const completion = await response.json();
          const answerText = completion.choices?.[0]?.message?.content || "";

          // Determine cited section
          let cited = "SOAP Record";
          if (answerText.includes("[Subjective]") || /subjective/i.test(question)) cited = "Subjective";
          else if (answerText.includes("[Objective]") || /objective|exam|slr|physical|vital|physio/i.test(question)) cited = "Objective";
          else if (answerText.includes("[Assessment]") || /assessment|diagnos|criteri|deni|approv/i.test(question)) cited = "Assessment";
          else if (answerText.includes("[Plan]") || /plan|cpt|procedure|order|rx|medication/i.test(question)) cited = "Plan";

          return NextResponse.json({
            patient_id: patient.id,
            patient_name: patient.name,
            question,
            answer: answerText,
            cited_section: cited,
            model_used: model,
          });
        }
      } catch {
        // Fall back gracefully to structured SOAP retrieval
      }
    }

    // Deterministic clinical retrieval fallback
    const fallback = getFallbackAnswer(patient, question);
    return NextResponse.json({
      patient_id: patient.id,
      patient_name: patient.name,
      question,
      answer: fallback.answer,
      cited_section: fallback.cited_section,
      evidence: fallback.evidence,
      model_used: "clinical-rag-engine",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "RAG query failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
