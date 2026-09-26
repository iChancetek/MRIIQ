"use client";

import { mockPdfUrl } from "@/lib/api";

interface Props {
  patientId: string;
}

export default function MockPdfViewer({ patientId }: Props) {
  const url = mockPdfUrl(patientId.toUpperCase());

  return (
    <div className="pdf-viewer">
      <iframe
        src={url}
        title={`Synthetic clinical document for ${patientId}`}
        id="pdf-viewer-frame"
      />
    </div>
  );
}
