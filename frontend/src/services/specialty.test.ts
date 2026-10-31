import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as api from './api';
import { fetchSpecialties } from './specialty';

describe('fetchSpecialties', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches specialties dynamically and returns non-empty list', async () => {
    const mockData = {
      data: [
        { id: '1', code: 'PRENATAL', slug: 'kham-theo-doi-thai-ky', name: 'Khám & Theo dõi Thai kỳ' },
        { id: '2', code: 'ULTRASOUND', slug: 'sieu-am-san-phu-khoa', name: 'Siêu âm Sản Phụ khoa Chẩn đoán' },
      ],
    };

    vi.spyOn(api, 'apiRequest').mockResolvedValueOnce(mockData as any);

    const items = await fetchSpecialties();
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].slug).toBe('kham-theo-doi-thai-ky');
    expect(items[0].name).toBe('Khám & Theo dõi Thai kỳ');
  });
});

