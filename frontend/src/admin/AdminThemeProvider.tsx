import type { ReactNode } from 'react';
import { App as AntApp, ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import 'dayjs/locale/vi';

/** Chỉ bọc khu vực admin để Ant Design không ảnh hưởng portal bệnh nhân. */
export function AdminThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider
      locale={viVN}
      theme={{
        token: {
          colorPrimary: '#1677ff',
          colorInfo: '#1677ff',
          colorSuccess: '#20b486',
          colorError: '#ef5350',
          colorText: '#183153',
          colorTextSecondary: '#6f7f8f',
          colorBorderSecondary: '#dfeaf3',
          fontFamily: "'Be Vietnam Pro', sans-serif",
          borderRadius: 10,
        },
        components: {
          Table: { headerBg: '#eaf4ff', headerColor: '#0b4f9c', borderColor: '#dfeaf3', rowHoverBg: '#f6fafd' },
          Button: { fontWeight: 600 },
        },
      }}
    >
      <AntApp>{children}</AntApp>
    </ConfigProvider>
  );
}
