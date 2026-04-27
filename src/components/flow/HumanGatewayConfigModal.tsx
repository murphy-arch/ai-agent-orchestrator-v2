import { useState } from "react";
import { X, Shield } from "lucide-react";

interface HumanGatewayConfig {
  label?: string;
  approvalPrompt?: string;
  timeoutMinutes?: number;
  timeoutAction?: string;
}

export default function HumanGatewayConfigModal({
  isOpen,
  onClose,
  initialConfig,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialConfig: HumanGatewayConfig | null;
  onSave: (config: HumanGatewayConfig) => void;
}) {
  const [label, setLabel] = useState(initialConfig?.label || "");
  const [approvalPrompt, setApprovalPrompt] = useState(initialConfig?.approvalPrompt || "");
  const [timeoutMinutes, setTimeoutMinutes] = useState(initialConfig?.timeoutMinutes ?? 0);
  const [timeoutAction, setTimeoutAction] = useState(initialConfig?.timeoutAction || "approve");

  const handleSave = () => {
    onSave({
      label: label.trim() || undefined,
      approvalPrompt: approvalPrompt.trim() || undefined,
      timeoutMinutes: timeoutMinutes || undefined,
      timeoutAction: timeoutAction || undefined,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-orange-500" />
            <h2 className="text-lg font-semibold text-gray-900">Human Gateway</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700">Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Human Approval"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700">Approval Prompt</label>
            <textarea
              value={approvalPrompt}
              onChange={(e) => setApprovalPrompt(e.target.value)}
              placeholder="What should the reviewer check before approving?"
              rows={3}
              className="mt-1 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
            <p className="mt-1 text-[10px] text-gray-400">
              This message is shown to the human reviewer in the Analytics panel.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700">Timeout (minutes)</label>
              <input
                type="number"
                min={0}
                value={timeoutMinutes}
                onChange={(e) => setTimeoutMinutes(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
              <p className="mt-1 text-[10px] text-gray-400">0 = no timeout</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Timeout Action</label>
              <select
                value={timeoutAction}
                onChange={(e) => setTimeoutAction(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="approve">Auto-approve</option>
                <option value="reject">Auto-reject</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700"
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
