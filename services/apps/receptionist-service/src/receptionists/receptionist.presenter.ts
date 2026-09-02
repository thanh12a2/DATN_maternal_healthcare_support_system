interface ProfileRecord {
  fullName: string;
  loginEmail: string | null;
  workPhone: string | null;
  address: string | null;
  department: string | null;
  gender: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ReceptionistRecord {
  id: string;
  accountId: string;
  employeeCode: string;
  status: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  profile: ProfileRecord | null;
}

export function presentReceptionist(
  record: ReceptionistRecord,
  adminView: boolean,
): object {
  const common = {
    id: record.id,
    status: record.status,
    version: record.version,
    profile: record.profile && {
      fullName: record.profile.fullName,
      loginEmail: record.profile.loginEmail,
      workPhone: record.profile.workPhone,
      address: record.profile.address,
      department: record.profile.department,
      gender: record.profile.gender,
      avatarUrl: record.profile.avatarUrl,
      createdAt: record.profile.createdAt,
      updatedAt: record.profile.updatedAt,
    },
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };

  return adminView
    ? {
        ...common,
        accountId: record.accountId,
        employeeCode: record.employeeCode,
      }
    : common;
}
