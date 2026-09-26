"use client";

import { mockPdfUrl } from "@/lib/api";
import { SOAP_PATIENTS } from "@/lib/soapData";

interface Props {
  patientId: string;
}

export default function MockPdfViewer({ patientId }: Props) {
  const cleanId = (patientId || "").trim().toUpperCase();
  const isValid = Boolean(SOAP_PATIENTS[cleanId]);
  const url = mockPdfUrl(cleanId);

  if (!isValid) {
    return (
      <div
        style={{
          padding: "24px 20px",
          textAlign: "center",
          color: "var(--text-muted)",
          fontSize: "0.85rem",
          background: "var(--bg-glass)",
          borderRadius: "var(--radius-md)",
          border: "1px dashed var(--border)",
        }}
      >
        📄 Clinical chart PDF is available for preset patient records: <strong>P001</strong>, <strong>P002</strong>, and <strong>P003</strong>.
      </div>
    );
  }

  return (
    <div className="pdf-viewer">
      <iframe
        src={url}
        title={`Synthetic clinical document for ${cleanId}`}
        id="pdf-viewer-frame"
      />
    </div>
  );
}
