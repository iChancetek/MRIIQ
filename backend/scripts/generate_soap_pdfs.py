"""
generate_soap_pdfs.py — Generates professional, synthetic clinical SOAP note PDFs
for patients P001, P002, and P003 using ReportLab.
"""
import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
)

SOAP_DATA = {
    "P001": {
        "id": "P001",
        "name": "Alex Morgan",
        "dob": "04/12/1982 (Age 44)",
        "gender": "Female",
        "plan_name": "Horizon Blue Cross PPO",
        "plan_status": "ACTIVE",
        "dos": "September 24, 2026",
        "provider": "Dr. Sarah Vance, MD (Spine & Pain Medicine, NPI: 1982736451)",
        "clinic": "Metro Spine & Musculoskeletal Institute, Suite 400",
        "subjective": (
            "<b>Chief Complaint:</b> Severe progressive lower back pain with right L5 dermatomal radiation and paresthesias for 10 weeks.<br/><br/>"
            "<b>History of Present Illness (HPI):</b> Patient is a 44-year-old female presenting with 10 weeks of unremitting lower back pain following lifting an object. "
            "Pain radiates down right posterior gluteal region into lateral calf and dorsum of foot (VAS score 7/10). Pain exacerbated by sitting and lumbar forward flexion; "
            "partially alleviated by lying supine with knee flexion. Patient denies bowel or bladder dysfunction, saddle numbness, or systemic symptoms. "
            "Activities of daily living and ambulation significantly impaired."
        ),
        "objective": (
            "<b>Vital Signs:</b> BP 124/78 mmHg, HR 72 bpm, Temp 98.4°F, BMI 24.2.<br/><br/>"
            "<b>Musculoskeletal Exam:</b> Antalgic gait favoring right lower extremity. Marked tenderness to palpation over L4-L5 and L5-S1 spinous interspaces with moderate right paraspinal muscle spasm. "
            "Lumbar flexion limited to 40° (normal > 60°), extension 10° with reproduction of radicular pain.<br/><br/>"
            "<b>Neurological Exam:</b> Motor: 5/5 bilaterally in quadriceps and gastrocnemius; right extensor hallucis longus (EHL) 4+/5. "
            "Sensory: Hypoesthesia to light touch and pinprick over right L5 dermatome. "
            "Reflexes: Patellar 2+ bilateral; Achilles 1+ on right, 2+ on left. "
            "Special Tests: <b>Straight Leg Raise (SLR) positive on right at 45°</b>; negative on left.<br/><br/>"
            "<b>Documented Conservative Therapy:</b> Completed <b>8 weeks of supervised physical therapy</b> (Apex Physical Therapy, 2x/week, Aug 1 - Sep 24, 2026) including core stabilization, McKenzie extension, and pelvic traction. Minimal functional improvement noted."
        ),
        "assessment": (
            "<b>Primary Diagnoses:</b><br/>"
            "1. Lumbosacral radiculopathy, right L5-S1 distribution (ICD-10 M54.16)<br/>"
            "2. Intractable lumbar intervertebral disc disorder with radiculopathy (ICD-10 M51.16)<br/>"
            "3. Lumbago with sciatica, right side (ICD-10 M54.41)<br/><br/>"
            "<b>Prior Authorization Guideline Criteria Evaluation:</b><br/>"
            "• Active Insurance Coverage: <b>MET</b> (Horizon Blue Cross PPO active)<br/>"
            "• Symptom / Pain Duration Threshold (≥ 6 weeks): <b>MET</b> (10 weeks documented)<br/>"
            "• Trial of Supervised Physical Therapy (≥ 6 weeks): <b>MET</b> (8 weeks documented)<br/>"
            "<b>Recommendation: APPROVE</b> — All medical necessity criteria for Lumbar Spine MRI are fully satisfied."
        ),
        "plan": (
            "<b>1. Diagnostic Imaging:</b> Prior Authorization requested for <b>Lumbar Spine MRI without contrast (CPT 72148)</b> to delineate disc herniation and nerve root impingement.<br/>"
            "<b>2. Medication:</b> Continue Meloxicam 15mg daily; start Gabapentin 300mg TID for neuropathic pain control.<br/>"
            "<b>3. Activity:</b> Gentle walking permitted; avoid heavy lifting > 10 lbs.<br/>"
            "<b>4. Follow-up:</b> Return to clinic immediately following MRI acquisition for evaluation and surgical/interventional pain management discussion."
        ),
        "expected": "APPROVE"
    },
    "P002": {
        "id": "P002",
        "name": "Jordan Lee",
        "dob": "09/23/1989 (Age 37)",
        "gender": "Male",
        "plan_name": "Aetna Choice POS",
        "plan_status": "ACTIVE",
        "dos": "September 24, 2026",
        "provider": "Dr. Marcus Thorne, MD (Family & Sports Medicine, NPI: 1472839102)",
        "clinic": "Oakridge Ambulatory Care Center, Suite 102",
        "subjective": (
            "<b>Chief Complaint:</b> Moderate low back stiffness and pain for 9 weeks.<br/><br/>"
            "<b>History of Present Illness (HPI):</b> 37-year-old male presents with 9 weeks of intermittent axial low back pain following home remodeling. "
            "Pain rated 5/10 on average. Localized to the lumbosacral junction without distal radiation below the knee. "
            "No numbness, paresthesias, weakness, or constitutional symptoms. "
            "Patient reports taking occasional over-the-counter Ibuprofen. "
            "<b>Patient explicitly documents that no formal physiotherapy was tried</b> to date due to work obligations."
        ),
        "objective": (
            "<b>Vital Signs:</b> BP 118/74 mmHg, HR 68 bpm, Temp 98.6°F, BMI 26.0.<br/><br/>"
            "<b>Musculoskeletal Exam:</b> Normal unassisted gait. Mild midline lumbar tenderness over L3-L4. No palpable spasm. "
            "Lumbar flexion 65° without neurological symptoms.<br/><br/>"
            "<b>Neurological Exam:</b> Motor 5/5 in all lower extremity groups bilaterally. Sensation intact to light touch in all dermatomes (L2-S1). "
            "Reflexes 2+ symmetrical bilaterally. Negative bilateral straight leg raise.<br/><br/>"
            "<b>Documented Conservative Therapy:</b> <b>No physiotherapy attempted (0 weeks).</b> Patient has not participated in any structured physical rehabilitation program."
        ),
        "assessment": (
            "<b>Primary Diagnoses:</b><br/>"
            "1. Non-specific mechanical low back pain (ICD-10 M54.50)<br/>"
            "2. Lumbar myofascial strain (ICD-10 S39.012A)<br/><br/>"
            "<b>Prior Authorization Guideline Criteria Evaluation:</b><br/>"
            "• Active Insurance Coverage: <b>MET</b> (Aetna POS active)<br/>"
            "• Symptom / Pain Duration Threshold (≥ 6 weeks): <b>MET</b> (9 weeks documented)<br/>"
            "• Trial of Supervised Physical Therapy (≥ 6 weeks): <b>NOT MET</b> (0 weeks attempted)<br/>"
            "<b>Recommendation: DENY</b> — Failure to complete prerequisite trial of supervised physical therapy (minimum 6 weeks required prior to advanced imaging)."
        ),
        "plan": (
            "<b>1. Conservative Management:</b> Referral issued for 6-week course of supervised outpatient physical therapy emphasizing core stability and biomechanics.<br/>"
            "<b>2. Advanced Imaging:</b> Lumbar MRI deferred pending completion of conservative therapy trial.<br/>"
            "<b>3. Pharmacology:</b> Naproxen 500mg BID with food PRN.<br/>"
            "<b>4. Follow-up:</b> Clinic re-evaluation in 6 weeks following physical therapy completion."
        ),
        "expected": "DENY"
    },
    "P003": {
        "id": "P003",
        "name": "Casey Kim",
        "dob": "11/05/1976 (Age 50)",
        "gender": "Non-binary",
        "plan_name": "UnitedHealthcare Choice Plus",
        "plan_status": "INACTIVE (Terminated)",
        "dos": "September 24, 2026",
        "provider": "Dr. Robert Patel, MD (Internal Medicine, NPI: 1829304817)",
        "clinic": "Community Health Partners, Clinic B",
        "subjective": (
            "<b>Chief Complaint:</b> Chronic low back ache for 12 weeks.<br/><br/>"
            "<b>History of Present Illness (HPI):</b> 50-year-old patient reports 12 weeks of persistent lower back pain. "
            "Severity rated 4-6/10. Aggravated by prolonged standing. Denies lower extremity radiation, weakness, numbness, or bladder changes. "
            "Patient states no physical therapy was ever tried. Patient was recently informed by employer of health coverage transition."
        ),
        "objective": (
            "<b>Vital Signs:</b> BP 130/82 mmHg, HR 76 bpm, BMI 27.8.<br/><br/>"
            "<b>Physical Exam:</b> Normal gait. Generalized lumbar tenderness. Negative straight leg raise bilaterally. "
            "Neurological examination intact throughout bilateral lower extremities.<br/><br/>"
            "<b>Payer Verification:</b> Clearinghouse 270/271 eligibility query returned <b>INACTIVE / TERMINATED COVERAGE</b> for policy on date of service.<br/><br/>"
            "<b>Conservative Therapy:</b> <b>No physiotherapy attempted (0 weeks).</b>"
        ),
        "assessment": (
            "<b>Primary Diagnoses:</b><br/>"
            "1. Chronic low back pain (ICD-10 M54.5)<br/>"
            "2. Lumbosacral spondylosis without radiculopathy (ICD-10 M47.816)<br/><br/>"
            "<b>Prior Authorization Guideline Criteria Evaluation:</b><br/>"
            "• Active Insurance Coverage: <b>NOT MET (Plan coverage is inactive / terminated)</b><br/>"
            "• Symptom / Pain Duration Threshold (≥ 6 weeks): <b>MET</b> (12 weeks documented)<br/>"
            "• Trial of Supervised Physical Therapy (≥ 6 weeks): <b>NOT MET</b> (0 weeks attempted)<br/>"
            "<b>Recommendation: DENY</b> — Insurance coverage is inactive, and prerequisite physical therapy trial was not completed."
        ),
        "plan": (
            "<b>1. Insurance Coordination:</b> Patient instructed to contact benefits coordinator to resolve coverage reinstatement.<br/>"
            "<b>2. Conservative Treatment:</b> Physical therapy referral on hold pending active coverage verification.<br/>"
            "<b>3. Diagnostic Imaging:</b> Prior authorization cannot be approved under inactive insurance policy.<br/>"
            "<b>4. Follow-up:</b> Re-contact clinic once coverage is active to schedule physical therapy."
        ),
        "expected": "DENY"
    }
}


def build_soap_pdf(data: dict, out_path: str):
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    doc = SimpleDocTemplate(
        out_path,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=32,
        bottomMargin=32
    )

    styles = getSampleStyleSheet()

    # Typography styles
    banner_style = ParagraphStyle(
        'RedBanner',
        fontName='Helvetica-Bold',
        fontSize=11,
        textColor=colors.HexColor('#DC2626'),
        alignment=1,
        spaceAfter=3
    )
    banner_sub = ParagraphStyle(
        'BannerSub',
        fontName='Helvetica',
        fontSize=8.5,
        textColor=colors.HexColor('#991B1B'),
        alignment=1,
        spaceAfter=8
    )
    title_style = ParagraphStyle(
        'DocTitle',
        fontName='Helvetica-Bold',
        fontSize=15,
        textColor=colors.HexColor('#0F172A'),
        alignment=1,
        spaceAfter=10
    )
    soap_header = ParagraphStyle(
        'SoapHeader',
        fontName='Helvetica-Bold',
        fontSize=11,
        textColor=colors.white,
        spaceBefore=0,
        spaceAfter=0
    )
    soap_text = ParagraphStyle(
        'SoapText',
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#1E293B')
    )
    label_s = ParagraphStyle('LabelS', fontName='Helvetica-Bold', fontSize=8.5, textColor=colors.HexColor('#475569'))
    val_s = ParagraphStyle('ValS', fontName='Helvetica', fontSize=8.5, textColor=colors.HexColor('#0F172A'))

    story = []

    # 1. Header Banner: Synthetic Notice
    story.append(Paragraph("SYNTHETIC CLINICAL DATA — FOR TESTING AND DEMONSTRATION ONLY", banner_style))
    story.append(Paragraph("NOT A REAL PATIENT • HIPAA / PHI EXEMPT • DO NOT USE FOR ACTUAL CLINICAL CARE", banner_sub))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#EF4444'), spaceAfter=8))

    # 2. Document Title
    story.append(Paragraph("PHYSICIAN CLINICAL DOCUMENTATION — SOAP NOTE", title_style))

    # 3. Patient Demographics & Encounter Info Table
    isActive = "ACTIVE" in data["plan_status"]
    status_color = "#16A34A" if isActive else "#DC2626"

    demo_data = [
        [
            Paragraph("Patient Name:", label_s), Paragraph(f"<b>{data['name']}</b>", val_s),
            Paragraph("Patient ID:", label_s), Paragraph(f"<b>{data['id']}</b>", val_s),
        ],
        [
            Paragraph("Date of Birth:", label_s), Paragraph(data['dob'], val_s),
            Paragraph("Date of Service:", label_s), Paragraph(data['dos'], val_s),
        ],
        [
            Paragraph("Insurance Plan:", label_s), Paragraph(data['plan_name'], val_s),
            Paragraph("Coverage Status:", label_s), Paragraph(f"<font color='{status_color}'><b>{data['plan_status']}</b></font>", val_s),
        ],
        [
            Paragraph("Attending:", label_s), Paragraph(data['provider'], val_s),
            Paragraph("Facility:", label_s), Paragraph(data['clinic'], val_s),
        ]
    ]
    demo_table = Table(demo_data, colWidths=[80, 190, 85, 185])
    demo_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
    ]))
    story.append(demo_table)
    story.append(Spacer(1, 10))

    # Helper to generate SOAP Section blocks
    def make_soap_section(letter_code: str, title: str, text_content: str, header_bg: str):
        header_para = Paragraph(f"<b>[{letter_code}] &nbsp; {title.upper()}</b>", soap_header)
        header_table = Table([[header_para]], colWidths=[540])
        header_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor(header_bg)),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('LEFTPADDING', (0,0), (-1,-1), 8),
        ]))

        body_para = Paragraph(text_content, soap_text)
        body_table = Table([[body_para]], colWidths=[540])
        body_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#FAFAFA')),
            ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#E2E8F0')),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
            ('LEFTPADDING', (0,0), (-1,-1), 8),
            ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ]))

        return KeepTogether([header_table, body_table, Spacer(1, 8)])

    # 4. SOAP Sections
    story.append(make_soap_section("S", "Subjective (History & Symptomatology)", data["subjective"], "#1E40AF"))
    story.append(make_soap_section("O", "Objective (Exam & Physical Therapy Record)", data["objective"], "#0D9488"))
    story.append(make_soap_section("A", "Assessment (Diagnoses & Prior Auth Policy Evaluation)", data["assessment"], "#7C3AED"))
    story.append(make_soap_section("P", "Plan (Imaging Study, Interventions & Orders)", data["plan"], "#0284C7"))

    # 5. Physician Sign-off block
    sign_data = [
        [
            Paragraph("<b>Electronically Signed By:</b>", label_s),
            Paragraph(f"{data['provider']} • Date: {data['dos']} 15:42 EST", val_s)
        ]
    ]
    sign_table = Table(sign_data, colWidths=[140, 400])
    sign_table.setStyle(TableStyle([
        ('LINEABOVE', (0,0), (-1,-1), 1, colors.HexColor('#94A3B8')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(Spacer(1, 4))
    story.append(sign_table)

    doc.build(story)
    print(f"Generated SOAP PDF: {out_path}")


def main():
    dest_dirs = [
        "data/mock-pdfs",
        "public/mock-pdfs",
        "frontend/public/mock-pdfs"
    ]
    for pid, pdata in SOAP_DATA.items():
        for d in dest_dirs:
            out_file = os.path.join(d, f"{pid}.pdf")
            build_soap_pdf(pdata, out_file)

if __name__ == "__main__":
    main()
