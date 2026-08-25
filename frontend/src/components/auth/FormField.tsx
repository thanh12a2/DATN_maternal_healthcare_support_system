import type { ReactNode } from 'react';
import type { FieldState } from '../../schemas/auth';

interface BaseProps {
  id: string;
  label: string;
  message?: string;
  state?: FieldState;
  full?: boolean;
  icon: ReactNode;
  children: ReactNode;
}

export function FormField({ id, label, message, state = 'idle', full, icon, children }: BaseProps) {
  return (
    <div className={`field ${full ? 'full' : ''} ${state !== 'idle' ? state : ''}`}>
      <label className="field-label" htmlFor={id}>{label}</label>
      <div className="control-wrap">
        <span className="control-icon">{icon}</span>
        {children}
      </div>
      <p className="field-message" aria-live="polite">{message}</p>
    </div>
  );
}
