import { useState } from "react";
import { X, GitBranch } from "lucide-react";

interface ConditionConfig {
  label: string;
  operator: string;
  value: string;
}

const OPERATORS = [
  { key: "contains", label: "Contains", example: "response contains 'urgent'" },
  { key: "equals", label: "Equals", example: "response equals 'approved'" },
  { key: "startsWith", label: "Starts With", example: "response starts with 'YES'" },
  { key: "notEmpty", label: "Not Empty", example: "response is not empty" },
  { key: "greaterThan", label: "Greater Than (numeric)", example: "score > 50" },
  { key: "lessThan", label: "Less Than (numeric)", example: "score < 100" },
];

export default function ConditionConfigModal({
  isOpen,
  onClose,
  initialConfig,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialConfig: ConditionConfig | null;
  onSave: (config: ConditionConfig) => void;
}) {
  const [label, setLabel] = useState(initialConfig?.label || "");
  const [operator, setOperator] = useState(initialConfig?.operator || "contains");
  const [value, setValue] = useState(initialConfig?.value || "");

  const handleSave = () => {
    onSave({ label: label || "Condition", operator, value });
    onClose();
  };

  if (!isOpen) return null;

  const opMeta = OPERATORS.find((o) => o.key === operator);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-md rounded-2xl border overflow-hidden bg-white border-gray-200 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <GitBranch size={16} style={{ color: "#FBBF24" }} />
            <span className="text-sm font-semibold text-gray-900">Configure Condition</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Label */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Condition Name</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Is Urgent?"
              className="w-full mt-1 px-3 py-2 rounded-lg border text-sm outline-none focus:ring-1 bg-gray-50 border-gray-200 text-gray-900"
            />
          </div>

          {/* Operator */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Operator</label>
            <select
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg border text-sm outline-none focus:ring-1 bg-gray-50 border-gray-200 text-gray-900"
            >
              {OPERATORS.map((op) => (
                <option key={op.key} value={op.key}>
                  {op.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-400 mt-1">{opMeta?.example}</p>
          </div>

          {/* Value (hidden for notEmpty) */}
          {operator !== "notEmpty" && (
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Compare Value</label>
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="urgent"
                className="w-full mt-1 px-3 py-2 rounded-lg border text-sm outline-none focus:ring-1 bg-gray-50 border-gray-200 text-gray-900"
              />
            </div>
          )}

          {/* Wiring hint */}
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-100">
            <p className="text-[11px] text-amber-700">
              <strong>Tip:</strong> Connect the right handle (green) for the{" "}
              <em>true</em> branch and the bottom handle (red) for the{" "}
              <em>false</em> branch.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-lg text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors"
          >
            Save Config
          </button>
        </div>
      </div>
    </div>
  );
}
