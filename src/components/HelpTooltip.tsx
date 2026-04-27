import { useState, useRef, useEffect } from "react";
import { HelpCircle } from "lucide-react";

interface HelpTooltipProps {
  text: string;
  className?: string;
  width?: string;
}

export default function HelpTooltip({ text, className = "", width = "w-64" }: HelpTooltipProps) {
  const [show, setShow] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setShow(true), 300);
  };

  const handleLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setShow(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <span
      className={`relative inline-flex items-center align-middle ml-1.5 ${className}`}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
    >
      <HelpCircle className="h-3.5 w-3.5 text-gray-400 cursor-help hover:text-gray-600 transition-colors" />
      {show && (
        <span
          className={`absolute z-50 ${width} bottom-full left-1/2 -translate-x-1/2 mb-2 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg`}
          role="tooltip"
        >
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900" />
        </span>
      )}
    </span>
  );
}

interface LabelWithHelpProps {
  label: string;
  helpText: string;
  required?: boolean;
}

export function LabelWithHelp({ label, helpText, required }: LabelWithHelpProps) {
  return (
    <label className="flex items-center text-sm font-medium text-gray-700">
      {label}
      {required && <span className="text-red-500 ml-0.5">*</span>}
      <HelpTooltip text={helpText} />
    </label>
  );
}
