"use client";

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export default function PatientInput({ value, onChange }: Props) {
  return (
    <div className="form-group">
      <label htmlFor="patient-id" className="form-label">
        Patient ID
      </label>
      <input
        id="patient-id"
        className="form-input"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. P001, P002, P003"
        autoComplete="off"
      />
    </div>
  );
}
