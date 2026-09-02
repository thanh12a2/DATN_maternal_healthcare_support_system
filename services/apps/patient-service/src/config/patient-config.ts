const required = [
  'PATIENT_DATABASE_URL',
  'AUTH_JWT_PUBLIC_KEY',
  'AUTH_JWT_KEY_ID',
  'PATIENT_NATIONAL_ID_ENCRYPTION_KEY',
  'PATIENT_NATIONAL_ID_LOOKUP_PEPPER',
  'PATIENT_INTERNAL_JWT_PUBLIC_KEY',
  'PATIENT_INTERNAL_JWT_KEY_ID',
  'PATIENT_INTERNAL_JWT_ISSUER',
  'PATIENT_INTERNAL_JWT_AUDIENCE',
] as const;

export function validatePatientConfig(
  config: Record<string, unknown>,
): Record<string, unknown> {
  for (const key of required) {
    const value = config[key];
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`Missing required Patient Service configuration: ${key}`);
    }
  }
  const issuer = config.JWT_ISSUER ?? config.AUTH_JWT_ISSUER;
  const audience = config.JWT_AUDIENCE ?? config.AUTH_JWT_AUDIENCE;
  if (
    typeof issuer !== 'string' ||
    !issuer ||
    typeof audience !== 'string' ||
    !audience
  ) {
    throw new Error(
      'Missing required Patient Service JWT issuer/audience configuration',
    );
  }
  return { ...config, AUTH_JWT_ISSUER: issuer, AUTH_JWT_AUDIENCE: audience };
}
