import { SearchOutlined } from '@ant-design/icons';
import { Input } from 'antd';
import type { InputRef } from 'antd';
import { useEffect, useRef, useState } from 'react';

interface Props {
  onSearch: (q: string) => void;
  resetSignal: number;
}

export function PatientSearchBar({ onSearch, resetSignal }: Props) {
  const ref = useRef<InputRef>(null);
  const [value, setValue] = useState('');

  const handleSearch = (val: string) => {
    onSearch(val.trim());
  };

  useEffect(() => {
    setValue('');
    ref.current?.focus();
  }, [resetSignal]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.isContentEditable;
      if ((e.ctrlKey && e.key.toLowerCase() === 'k') || (e.key === '/' && !typing)) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <Input.Search
      ref={ref}
      autoFocus
      allowClear
      enterButton="Tìm kiếm"
      size="middle"
      prefix={<SearchOutlined style={{ color: '#0B5CAD', marginRight: 4, fontSize: 16 }} />}
      suffix={
        <span
          style={{
            fontSize: 11,
            color: '#6b7280',
            background: '#f3f4f6',
            padding: '2px 6px',
            borderRadius: 4,
            fontWeight: 500,
            userSelect: 'none',
            marginRight: 6,
          }}
        >
          / hoặc Ctrl+K
        </span>
      }
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        if (!e.target.value) {
          onSearch('');
        }
      }}
      onSearch={handleSearch}
      placeholder="Tìm theo tên bệnh nhân, SĐT, CCCD, mã lịch hẹn... (Nhấn Enter hoặc nút Tìm)"
      style={{
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
      }}
    />
  );
}
