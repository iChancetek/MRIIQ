import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Frame, HRFlowable

def create_synthetic_pdf(output_path: str, patient_id: str, name: str, plan_status: str, clinical_note: str):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )
    
    styles = getSampleStyleSheet()
    
    # Custom Styles
    disclaimer_style = ParagraphStyle(
        'Disclaimer',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        textColor=colors.HexColor('#DC2626'),
        alignment=1,
        spaceAfter=6
    )
    sub_disclaimer_style = ParagraphStyle(
        'SubDisclaimer',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        textColor=colors.HexColor('#B91C1C'),
        alignment=1,
        spaceAfter=15
    )
    header_style = ParagraphStyle(
        'DocHeader',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=18,
        textColor=colors.HexColor('#0F172A'),
        alignment=1,
        spaceAfter=15
    )
    label_style = ParagraphStyle(
        'FieldLabel',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        textColor=colors.HexColor('#334155')
    )
    value_style = ParagraphStyle(
        'FieldValue',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        textColor=colors.HexColor('#0F172A')
    )
    body_style = ParagraphStyle(
        'ClinicalBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=11,
        leading=16,
        textColor=colors.HexColor('#1E293B')
    )
    section_title_style = ParagraphStyle(
        'SectionTitle',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=13,
        textColor=colors.HexColor('#1E3A8A'),
        spaceBefore=10,
        spaceAfter=8
    )

    story = []
    
    # Red Warning Banner
    story.append(Paragraph("SYNTHETIC DATA — NOT A REAL PATIENT", disclaimer_style))
    story.append(Paragraph("FOR DEMONSTRATION & TESTING ONLY", sub_disclaimer_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#EF4444'), spaceAfter=15))
    
    # Document Title
    story.append(Paragraph("Synthetic Prior Authorization Clinical Record", header_style))
    story.append(Spacer(1, 10))
    
    # Patient Demographic Info Table
    data = [
        [Paragraph("Patient ID:", label_style), Paragraph(patient_id, value_style),
         Paragraph("Plan Status:", label_style), Paragraph(f"<b>{plan_status}</b>", value_style)],
        [Paragraph("Patient Name:", label_style), Paragraph(name, value_style),
         Paragraph("Procedure:", label_style), Paragraph("Lumbar Spine MRI (CPT 72148)", value_style)],
    ]
    t = Table(data, colWidths=[90, 160, 90, 160])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t)
    story.append(Spacer(1, 18))
    
    # Clinical Note Section
    story.append(Paragraph("Physician Clinical Documentation", section_title_style))
    story.append(HRFlowable(width="100%", thickness=0.8, color=colors.HexColor('#CBD5E1'), spaceAfter=10))
    
    formatted_note = clinical_note.replace("\n", "<br/>")
    story.append(Paragraph(formatted_note, body_style))
    story.append(Spacer(1, 30))
    
    # Footer Notice
    footer_text = Paragraph(
        "<i>Notice: This synthetic mock document was automatically generated for automated and human-in-the-loop prior authorization testing. No protected health information (PHI) is contained herein.</i>",
        ParagraphStyle('Footer', parent=styles['Italic'], fontSize=8, textColor=colors.HexColor('#64748B'), alignment=1)
    )
    story.append(footer_text)
    
    doc.build(story)
    print(f"Generated synthetic PDF: {output_path}")

if __name__ == "__main__":
    records = [
        {
            "id": "P001",
            "name": "Alex Morgan",
            "status": "Active",
            "note": "Back pain for 10 weeks.\nPhysiotherapy for 8 weeks.\nPatient continues to experience persistent lower back pain despite conservative physiotherapy management. Ordering lumbar spine MRI without contrast."
        },
        {
            "id": "P002",
            "name": "Jordan Lee",
            "status": "Active",
            "note": "Patient presents with persistent lumbar back pain for 9 weeks following sports-related activity.\nPhysiotherapy is absent from documented medical records. No conservative physical therapy has been initiated.\nOrdering physician requests Lumbar Spine MRI."
        },
        {
            "id": "P003",
            "name": "Casey Kim",
            "status": "Inactive",
            "note": "Patient presents with chronic lower back pain for 12 weeks.\nNo physiotherapy was tried.\nInsurance policy status is currently Inactive.\nOrdering physician requests Lumbar Spine MRI."
        }
    ]
    
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "mock-pdfs"))
    for rec in records:
        pdf_path = os.path.join(base_dir, f"{rec['id']}.pdf")
        create_synthetic_pdf(pdf_path, rec["id"], rec["name"], rec["status"], rec["note"])
