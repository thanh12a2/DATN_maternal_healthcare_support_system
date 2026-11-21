import { cleanup,fireEvent,render,screen } from '@testing-library/react';
import { afterEach,describe,expect,it,vi } from 'vitest';
import { PatientPreferences,PersonalizationNotice } from './PatientPreferences';
import type { ChatRequest } from '../../../../services/chatbot';
afterEach(cleanup);
describe('Patient preferences',()=>{
  it('reads only on request, labels self-declared data and deletes without touching profile',async()=>{
    const onChanged=vi.fn();
    const request=vi.fn(async(_path,init)=>({revision:1,values:init?.method==='DELETE'?{}:{preferredPeriod:'morning',preferredSelectionMode:'RANK'},source:'user_declared',updatedAt:null,expiresAt:null}));
    render(<PatientPreferences request={request as ChatRequest} onChanged={onChanged}/>);
    expect(request).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Sở thích đặt khám'));
    await screen.findByText('Buổi sáng');
    expect(screen.getByText(/Bạn tự khai/)).toBeVisible();
    fireEvent.click(screen.getByText('Xóa sở thích đã lưu'));
    await screen.findByText('Chưa có sở thích đặt khám đã lưu.');
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(request.mock.calls.every(([url])=>url==='/api/assistant/memory')).toBe(true);
  });
  it('separates official record provenance from user preferences',()=>{
    render(<PersonalizationNotice value={{version:'patient-memory-1.0.0',aiSummary:'Tóm tắt hành chính',userDeclared:{revision:0,values:{},source:'user_declared',updatedAt:null,expiresAt:null},official:{source:'system_record',checkedAt:'2026-11-16T00:00:00Z',profileStatus:'COMPLETE',profileVersion:1,lastCompleted:null}}}/>);
    expect(screen.getByText('Dữ liệu chính thức — hệ thống')).toBeVisible();
    expect(screen.getByText('Sở thích do bạn tự khai tại lượt này')).toBeVisible();
    expect(screen.queryByText(/CCCD/)).not.toBeInTheDocument();
  });
});
