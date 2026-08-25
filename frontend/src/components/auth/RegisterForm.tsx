import { useState } from 'react';
import { hasValidationErrors, type Gender, type RegisterFormValues, validateRegister } from '../../schemas/auth';
import type { ValidationResult } from '../../schemas/auth';
import { register } from '../../services/auth';
import { FormField } from './FormField';
import { PasswordField } from './PasswordField';
import { CalendarIcon, GenderIcon, MailIcon, PhoneIcon, ShieldIcon, UserIcon } from './icons';

interface RegisterFormProps {
  onSwitchMode: () => void;
}

const initialValues: RegisterFormValues = {
  fullName: '',
  birthDate: '',
  phone: '',
  gender: '',
  email: '',
  password: '',
  confirmPassword: '',
  terms: false,
};

type RegisterResultMap = Partial<Record<keyof RegisterFormValues, ValidationResult>>;

export function RegisterForm({ onSwitchMode }: RegisterFormProps) {
  const [values, setValues] = useState(initialValues);
  const [results, setResults] = useState<RegisterResultMap>({});
  const [alert, setAlert] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function setField<K extends keyof RegisterFormValues>(field: K, value: RegisterFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function validateField(field: keyof ReturnType<typeof validateRegister>) {
    const nextResults = validateRegister(values);
    setResults((current) => ({ ...current, [field]: nextResults[field] }));
    return nextResults[field].valid;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextResults = validateRegister(values);
    setResults(nextResults);
    setAlert(null);

    if (hasValidationErrors(nextResults)) {
      setAlert({ type: 'error', message: nextResults.terms.valid ? 'Vui lòng kiểm tra lại các thông tin được đánh dấu.' : nextResults.terms.message });
      return;
    }

    setSubmitting(true);
    try {
      await register(values);
      setAlert({ type: 'success', message: 'Tạo tài khoản thành công. Bạn có thể đăng nhập để bắt đầu đặt lịch khám.' });
    } catch (error) {
      setAlert({ type: 'error', message: error instanceof Error ? error.message : 'Tạo tài khoản thất bại.' });
    } finally {
      setSubmitting(false);
    }
  }

  const fieldState = (field: keyof RegisterFormValues) => results[field] ? (results[field]?.valid ? 'success' : 'error') : 'idle';

  return (
    <div className="form-view active" data-testid="register-view">
      <header className="auth-header">
        <span className="mode-indicator">Bắt đầu hành trình chăm sóc</span>
        <h2>Tạo tài khoản</h2>
        <p>Đăng ký để đặt lịch khám và quản lý sức khỏe thuận tiện hơn.</p>
      </header>

      {alert && <div className={`form-alert show ${alert.type}`} role="status">{alert.message}</div>}

      <form noValidate onSubmit={handleSubmit}>
        <div className="form-grid">
          <FormField id="full-name" label="Họ và tên" icon={<UserIcon />} message={results.fullName?.message} state={fieldState('fullName')}>
            <input className="input" id="full-name" name="fullName" autoComplete="name" placeholder="Nguyễn Văn An" value={values.fullName} aria-invalid={results.fullName?.valid === false} onChange={(event) => setField('fullName', event.target.value)} onBlur={() => validateField('fullName')} />
          </FormField>

          <FormField id="birth-date" label="Ngày sinh" icon={<CalendarIcon />} message={results.birthDate?.message} state={fieldState('birthDate')}>
            <input className="input" id="birth-date" name="birthDate" type="date" autoComplete="bday" value={values.birthDate} aria-invalid={results.birthDate?.valid === false} onChange={(event) => setField('birthDate', event.target.value)} onBlur={() => validateField('birthDate')} />
          </FormField>

          <FormField id="phone" label="Số điện thoại" icon={<PhoneIcon />} message={results.phone?.message} state={fieldState('phone')}>
            <input className="input" id="phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="090 123 4567" value={values.phone} aria-invalid={results.phone?.valid === false} onChange={(event) => setField('phone', event.target.value)} onBlur={() => validateField('phone')} />
          </FormField>

          <FormField id="gender" label="Giới tính" icon={<GenderIcon />} message={results.gender?.message} state={fieldState('gender')}>
            <select className="select" id="gender" name="gender" value={values.gender} aria-invalid={results.gender?.valid === false} onChange={(event) => setField('gender', event.target.value as Gender)} onBlur={() => validateField('gender')}>
              <option value="">Chọn giới tính</option>
              <option>Nam</option>
              <option>Nữ</option>
              <option>Khác</option>
              <option>Không muốn cung cấp</option>
            </select>
          </FormField>

          <FormField id="email" label="Email" full icon={<MailIcon />} message={results.email?.message} state={fieldState('email')}>
            <input className="input" id="email" name="email" type="email" autoComplete="email" placeholder="email@domain.vn" value={values.email} aria-invalid={results.email?.valid === false} onChange={(event) => setField('email', event.target.value)} onBlur={() => validateField('email')} />
          </FormField>

          <PasswordField label="Mật khẩu" name="password" value={values.password} autoComplete="new-password" placeholder="Tối thiểu 8 ký tự" message={results.password?.message} state={fieldState('password')} onChange={(value) => setField('password', value)} onBlur={() => validateField('password')} />

          <PasswordField label="Xác nhận mật khẩu" name="confirmPassword" value={values.confirmPassword} autoComplete="new-password" placeholder="Nhập lại mật khẩu" message={results.confirmPassword?.message} state={fieldState('confirmPassword')} onChange={(value) => setField('confirmPassword', value)} onBlur={() => validateField('confirmPassword')} />
        </div>

        <label className={`check-label terms ${results.terms?.valid === false ? 'terms-error' : ''}`}>
          <input type="checkbox" checked={values.terms} onChange={(event) => setField('terms', event.target.checked)} />
          <span>Tôi đồng ý với <a className="text-link" href="#">Điều khoản sử dụng</a> và <a className="text-link" href="#">Chính sách bảo mật</a>.</span>
        </label>

        <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}</button>
      </form>

      <p className="switch-copy">Đã có tài khoản? <button className="text-link mode-switch" type="button" onClick={onSwitchMode}>Đăng nhập</button></p>
      <div className="security-badge"><ShieldIcon />Dữ liệu sức khỏe được xử lý theo tiêu chuẩn bảo mật</div>
    </div>
  );
}
