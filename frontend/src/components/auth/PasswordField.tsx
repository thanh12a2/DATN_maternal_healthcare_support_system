import { useId, useState } from 'react';
import type { FieldState } from '../../schemas/auth';
import { LockIcon, EyeClosedIcon, EyeOpenIcon } from './icons';
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
  onChange: (value: string) => void;
  onBlur?: () => void;
}

export function PasswordField({
  label,
  name,
  value,
  autoComplete,
  placeholder,
  message,
  state = 'idle',
  full,
  onChange,
  onBlur,
}: PasswordFieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <FormField id={id} label={label} message={message} state={state} full={full} icon={<LockIcon />}>
      <input
        className="input"
        id={id}
        name={name}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        minLength={8}
        aria-invalid={state === 'error'}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
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
}
