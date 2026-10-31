import React, { createContext, useContext } from 'react';
import { useAuthSession } from '../../app/AuthSessionProvider';
import type { Requester } from '../../services/catalog';

interface AdminAuditContextValue {
  request: Requester;
}

const AdminAuditContext = createContext<AdminAuditContextValue | null>(null);

/**
 * Context cung cấp request đã được bọc ghi vết kiểm toán toàn diện ở tầng AuthSessionProvider
 */
export function AdminAuditProvider({ children }: { children: React.ReactNode }) {
  const { request } = useAuthSession();

  return (
    <AdminAuditContext.Provider value={{ request }}>
      {children}
    </AdminAuditContext.Provider>
  );
}

/**
 * Hook cho các component admin lấy requester
 */
export function useAdminRequester(): Requester {
  const ctx = useContext(AdminAuditContext);
  const fallback = useAuthSession();
  return ctx?.request || fallback.request;
}
