import { useId, useState, forwardRef } from 'react';
import type { FieldState } from '../../../schemas/auth';
import { LockIcon, EyeClosedIcon, EyeOpenIcon, CheckIcon } from './icons';
import { FormField } from './FormField';

interface PasswordFieldProps {
  label: string;
  name: string;
  value: string;
  autoComplete: string;
  placeholder: string;
  message?: string;
  state?: FieldState;
  full?: boolean;
  autoFocus?: boolean;
  showSuccessTick?: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
}

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField(
  {
    label,
    name,
    value,
    autoComplete,
    placeholder,
    message,
    state = 'idle',
    full,
    autoFocus,
    showSuccessTick,
    onChange,
    onBlur,
    onFocus,
  },
  ref
) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <FormField id={id} label={label} message={message} state={state} full={full} icon={<LockIcon />}>
      <input
        ref={ref}
        className={`input ${showSuccessTick ? 'has-success-tick' : ''}`}
        id={id}
        name={name}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        autoFocus={autoFocus}
        aria-invalid={state === 'error'}
        aria-describedby={message ? `${id}-message` : undefined}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        onFocus={onFocus}
      />

      {showSuccessTick && (
        <span className="field-tick-indicator success" aria-label="Mật khẩu khớp">
          <CheckIcon />
        </span>
      )}

      <button
        className="icon-button password-toggle"
        type="button"
        aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        aria-controls={id}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <EyeClosedIcon /> : <EyeOpenIcon />}
      </button>
    </FormField>
  );
});
