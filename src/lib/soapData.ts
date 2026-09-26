/**
 * soapData.ts — Comprehensive synthetic physician clinical documentation
 * in SOAP (Subjective, Objective, Assessment, Plan) format for P001, P002, and P003.
 * SYNTHETIC DATA — FOR DEMONSTRATION AND TESTING ONLY.
 */

export interface SoapPatientRecord {
  id: string;
  name: string;
  dob: string;
  gender: string;
  plan_name: string;
  plan_status: string;
  dos: string;
  provider: string;
  clinic: string;
  subjective: {
    chief_complaint: string;
    hpi: string;
    pain_duration_weeks: number;
    pain_severity_vas: string;
    functional_impact: string;
  };
  objective: {
    vitals: string;
    physical_exam: string;
    neuro_exam: string;
    slr_test: string;
    physio_attempted: boolean;
    physio_duration_weeks: number;
    physio_notes: string;
  };
  assessment: {
    diagnoses: string[];
    criteria_plan_active: boolean;
    criteria_pain_duration_met: boolean;
    criteria_physio_met: boolean;
    recommendation: "APPROVE" | "DENY";
    denial_reasons: string[];
  };
  plan: {
    procedure_requested: string;
    cpt_code: string;
    orders: string[];
    medications: string[];
    follow_up: string;
  };
  full_summary: string;
}

export const SOAP_PATIENTS: Record<string, SoapPatientRecord> = {
  P001: {
    id: "P001",
    name: "Alex Morgan",
    dob: "04/12/1982 (Age 44)",
    gender: "Female",
    plan_name: "Horizon Blue Cross PPO",
    plan_status: "ACTIVE",
    dos: "September 24, 2026",
    provider: "Dr. Sarah Vance, MD (Spine & Pain Medicine, NPI: 1982736451)",
    clinic: "Metro Spine & Musculoskeletal Institute, Suite 400",
    subjective: {
      chief_complaint: "Severe progressive lower back pain with right L5 dermatomal radiation for 10 weeks.",
      hpi: "Patient is a 44-year-old presenting with 10 weeks of unremitting lower back pain following lifting an object. Pain radiates into right posterior gluteal region, lateral calf, and dorsum of foot (VAS 7/10). Exacerbated by sitting and forward flexion; partially alleviated by recumbency. Denies bowel or bladder dysfunction, saddle numbness, or fevers.",
      pain_duration_weeks: 10,
      pain_severity_vas: "7/10",
      functional_impact: "Ambulation and daily activities significantly impaired. Unable to sit for > 15 minutes.",
    },
    objective: {
      vitals: "BP 124/78 mmHg, HR 72 bpm, Temp 98.4°F, BMI 24.2.",
      physical_exam: "Antalgic gait favoring right side. Marked tenderness over L4-L5 and L5-S1 spinous interspaces with moderate right paraspinal spasm. Lumbar flexion limited to 40° (normal > 60°), extension 10°.",
      neuro_exam: "Motor 5/5 bilaterally except right extensor hallucis longus (EHL) 4+/5. Hypoesthesia over right L5 dermatome. DTRs: Patellar 2+ bilateral; Achilles 1+ on right, 2+ on left.",
      slr_test: "Straight Leg Raise (SLR) positive on right at 45°; negative on left.",
      physio_attempted: true,
      physio_duration_weeks: 8,
      physio_notes: "Completed 8 weeks of supervised physical therapy at Apex Physical Therapy (2x/week, Aug 1 - Sep 24, 2026) including core stabilization, McKenzie extension, and pelvic traction. Minimal functional improvement noted.",
    },
    assessment: {
      diagnoses: [
        "Lumbosacral radiculopathy, right L5-S1 distribution (ICD-10 M54.16)",
        "Intractable lumbar intervertebral disc disorder with radiculopathy (ICD-10 M51.16)",
        "Lumbago with sciatica, right side (ICD-10 M54.41)",
      ],
      criteria_plan_active: true,
      criteria_pain_duration_met: true,
      criteria_physio_met: true,
      recommendation: "APPROVE",
      denial_reasons: [],
    },
    plan: {
      procedure_requested: "Lumbar Spine MRI without contrast",
      cpt_code: "CPT 72148",
      orders: [
        "Prior Authorization requested for Lumbar Spine MRI without contrast (CPT 72148)",
        "Evaluate for disc herniation and nerve root impingement",
      ],
      medications: [
        "Continue Meloxicam 15mg daily",
        "Start Gabapentin 300mg TID for neuropathic pain control",
      ],
      follow_up: "Return to clinic immediately following MRI completion for surgical/interventional spine consultation.",
    },
    full_summary:
      "Alex Morgan (P001) is a 44-year-old patient with an active Horizon Blue Cross PPO plan presenting with 10 weeks of documented lower back pain and right L5 radiculopathy. The patient has successfully completed 8 weeks of formal, supervised physical therapy without adequate symptom resolution. All clinical prior authorization criteria under Lumbar Spine MRI guidelines are fully satisfied. Final Recommendation: APPROVE.",
  },
  P002: {
    id: "P002",
    name: "Jordan Lee",
    dob: "09/23/1989 (Age 37)",
    gender: "Male",
    plan_name: "Aetna Choice POS",
    plan_status: "ACTIVE",
    dos: "September 24, 2026",
    provider: "Dr. Marcus Thorne, MD (Family & Sports Medicine, NPI: 1472839102)",
    clinic: "Oakridge Ambulatory Care Center, Suite 102",
    subjective: {
      chief_complaint: "Moderate low back stiffness and pain for 9 weeks.",
      hpi: "37-year-old presenting with 9 weeks of intermittent axial low back pain following home remodeling. Pain rated 5/10. Localized to lumbosacral junction without distal radiation below knee. No numbness, weakness, or constitutional symptoms. Patient reports taking occasional over-the-counter Ibuprofen. Patient explicitly notes that no formal physiotherapy or structured rehabilitation program was tried to date.",
      pain_duration_weeks: 9,
      pain_severity_vas: "5/10",
      functional_impact: "Avoids heavy lifting; functional at desk job with mild discomfort.",
    },
    objective: {
      vitals: "BP 118/74 mmHg, HR 68 bpm, Temp 98.6°F, BMI 26.0.",
      physical_exam: "Normal unassisted gait. Mild midline lumbar tenderness over L3-L4. No spasm. Lumbar flexion 65° without radicular symptoms.",
      neuro_exam: "Motor 5/5 in all lower extremity groups. Sensation intact throughout L2-S1. Reflexes 2+ symmetrical.",
      slr_test: "Straight Leg Raise test negative bilaterally.",
      physio_attempted: false,
      physio_duration_weeks: 0,
      physio_notes: "No physiotherapy attempted (0 weeks). Patient has not participated in any structured physical rehabilitation program.",
    },
    assessment: {
      diagnoses: [
        "Non-specific mechanical low back pain (ICD-10 M54.50)",
        "Lumbar myofascial strain (ICD-10 S39.012A)",
      ],
      criteria_plan_active: true,
      criteria_pain_duration_met: true,
      criteria_physio_met: false,
      recommendation: "DENY",
      denial_reasons: [
        "No physiotherapy was attempted (explicitly stated in clinical note).",
        "Failure to complete prerequisite trial of supervised physical therapy (minimum 6 weeks required prior to advanced neuroimaging).",
      ],
    },
    plan: {
      procedure_requested: "Lumbar Spine MRI without contrast",
      cpt_code: "CPT 72148",
      orders: [
        "Referral issued for 6-week course of supervised outpatient physical therapy",
        "Lumbar spine MRI deferred pending completion of conservative therapy trial",
      ],
      medications: ["Naproxen 500mg BID with food PRN"],
      follow_up: "Clinic re-evaluation in 6 weeks following completion of physical therapy.",
    },
    full_summary:
      "Jordan Lee (P002) is a 37-year-old patient with an active Aetna plan presenting with 9 weeks of axial lower back pain. While the pain duration threshold is satisfied (9 weeks vs 6-week minimum), no formal physical therapy trial was attempted (0 weeks). Clinical guidelines mandate a minimum 6-week trial of conservative physiotherapy prior to advanced MRI imaging. Final Recommendation: DENY due to lack of required physiotherapy trial.",
  },
  P003: {
    id: "P003",
    name: "Casey Kim",
    dob: "11/05/1976 (Age 50)",
    gender: "Non-binary",
    plan_name: "UnitedHealthcare Choice Plus",
    plan_status: "INACTIVE (Terminated)",
    dos: "September 24, 2026",
    provider: "Dr. Robert Patel, MD (Internal Medicine, NPI: 1829304817)",
    clinic: "Community Health Partners, Clinic B",
    subjective: {
      chief_complaint: "Chronic low back ache for 12 weeks.",
      hpi: "50-year-old patient reports 12 weeks of persistent lower back pain. Severity rated 4-6/10. Aggravated by prolonged standing. Denies lower extremity radiation, weakness, numbness, or bladder changes. Patient states no physical therapy was ever tried. Patient was recently informed of health coverage transition.",
      pain_duration_weeks: 12,
      pain_severity_vas: "4-6/10",
      functional_impact: "Discomfort with extended standing; able to perform desk work.",
    },
    objective: {
      vitals: "BP 130/82 mmHg, HR 76 bpm, BMI 27.8.",
      physical_exam: "Normal gait. Generalized lower lumbar tenderness. Full lumbar range of motion.",
      neuro_exam: "Neurological examination intact throughout bilateral lower extremities. DTRs 2+ symmetrical.",
      slr_test: "Straight Leg Raise test negative bilaterally.",
      physio_attempted: false,
      physio_duration_weeks: 0,
      physio_notes: "No physiotherapy attempted (0 weeks). Clearinghouse eligibility verification returned INACTIVE / TERMINATED policy coverage on date of service.",
    },
    assessment: {
      diagnoses: [
        "Chronic low back pain (ICD-10 M54.5)",
        "Lumbosacral spondylosis without radiculopathy (ICD-10 M47.816)",
      ],
      criteria_plan_active: false,
      criteria_pain_duration_met: true,
      criteria_physio_met: false,
      recommendation: "DENY",
      denial_reasons: [
        "Insurance plan is not active (Coverage Terminated).",
        "No physiotherapy was attempted (explicitly stated in clinical note).",
      ],
    },
    plan: {
      procedure_requested: "Lumbar Spine MRI without contrast",
      cpt_code: "CPT 72148",
      orders: [
        "Patient instructed to resolve insurance reinstatement with benefits coordinator",
        "Physical therapy referral on hold pending active coverage verification",
        "Prior authorization cannot be granted under inactive policy coverage",
      ],
      medications: ["Acetaminophen 650mg Q6H PRN"],
      follow_up: "Re-contact clinic once coverage is active to schedule physical therapy.",
    },
    full_summary:
      "Casey Kim (P003) is a 50-year-old patient with 12 weeks of chronic lower back pain. Payer verification returned INACTIVE/TERMINATED coverage, and no supervised physical therapy trial was attempted (0 weeks). Prior authorization cannot be approved under inactive insurance, and the prerequisite conservative trial has not been completed. Final Recommendation: DENY.",
  },
};

/**
 * Detects whether a patient's name or ID is mentioned in the given text or query.
 * Returns the matching patient ID ("P001", "P002", "P003") or null if none found.
 */
export function detectPatientInText(text: string): "P001" | "P002" | "P003" | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  // Check P001 / Alex Morgan
  if (
    /\b(p0*1|patient\s*1|pt\s*1|alex(\s+morgan)?)\b/i.test(lower) ||
    lower.includes("alex morgan")
  ) {
    return "P001";
  }

  // Check P002 / Jordan Lee
  if (
    /\b(p0*2|patient\s*2|pt\s*2|jordan(\s+lee)?)\b/i.test(lower) ||
    lower.includes("jordan lee")
  ) {
    return "P002";
  }

  // Check P003 / Casey Kim
  if (
    /\b(p0*3|patient\s*3|pt\s*3|casey(\s+kim)?)\b/i.test(lower) ||
    lower.includes("casey kim")
  ) {
    return "P003";
  }

  return null;
}
