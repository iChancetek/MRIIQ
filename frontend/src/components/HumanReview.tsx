"use client";

interface Props {
  recommendation: string;
  onDecision: (decision: string) => void;
}

export default function HumanReview({ recommendation, onDecision }: Props) {
  const isApprove = recommendation === "APPROVE";

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-icon yellow">👤</div>
        <div>
          <div className="card-title">Human Review Required</div>
          <div className="card-subtitle">
            The system recommends{" "}
            <strong style={{ color: isApprove ? "var(--approve)" : "var(--deny)" }}>
              {recommendation}
            </strong>
            . Do you accept this recommendation?
          </div>
        </div>
      </div>

      <div className="btn-row">
        <button
          className="btn btn-approve"
          onClick={() => onDecision("yes")}
          id="btn-approve"
        >
          ✓ Approve Decision
        </button>
        <button
          className="btn btn-deny"
          onClick={() => onDecision("no")}
          id="btn-reject"
        >
          ✗ Reject Decision
        </button>
      </div>
    </div>
  );
}
