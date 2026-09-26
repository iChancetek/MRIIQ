"use client";

interface Props {
  outcome: string;
}

export default function FinalOutcome({ outcome }: Props) {
  const isApproved = outcome.toLowerCase().includes("approved");

  return (
    <div className={`outcome-banner ${isApproved ? "approved" : "rejected"}`}>
      <div className="outcome-icon">{isApproved ? "✅" : "❌"}</div>
      <div
        className="outcome-title"
        style={{ color: isApproved ? "var(--approve)" : "var(--deny)" }}
      >
        {isApproved ? "Authorization Accepted" : "Authorization Rejected"}
      </div>
      <div className="outcome-subtitle">{outcome}</div>
    </div>
  );
}
