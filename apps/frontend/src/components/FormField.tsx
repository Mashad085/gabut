import { ReactNode } from 'react';

interface Props {
  label: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  hint?: string;
}

export default function FormField({ label, error, required, children, hint }: Props) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-slate-400">
        {label}{required && <span className="text-rose-400 ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-slate-600">{hint}</p>}
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}
