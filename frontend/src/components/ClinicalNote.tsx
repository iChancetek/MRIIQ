"use client";

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export default function ClinicalNote({ value, onChange }: Props) {
  return (
    <div className="form-group">
      <label htmlFor="clinical-note" className="form-label">
        Clinical Note
      </label>
      <textarea
        id="clinical-note"
        className="form-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter clinical note... e.g. 'Back pain for 10 weeks. Physiotherapy for 8 weeks.'"
        rows={5}
      />
    </div>
  );
}
