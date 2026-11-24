import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PregnancyWeekNavigator } from './PregnancyWeekNavigator';

function NavigatorHarness() {
  const [week, setWeek] = useState(12);
  return <PregnancyWeekNavigator week={week} onWeekChange={setWeek} />;
}

describe('PregnancyWeekNavigator', () => {
  it('updates the trimester and milestones when choosing a week', () => {
    render(<NavigatorHarness />);
    expect(screen.getByText('Hình thành nền tảng')).toBeTruthy();
    fireEvent.change(screen.getByRole('slider', { name: 'Tuần thai' }), { target: { value: '24' } });
    expect(screen.getByText('Giai đoạn dễ chịu')).toBeTruthy();
    expect(screen.getByText('Tuần 24 · Nghiệm pháp dung nạp glucose (24–28)').className).toBe('active');
    fireEvent.click(screen.getByRole('button', { name: 'TCN 3 (28–40)' }));
    expect(screen.getByText('Chặng nước rút')).toBeTruthy();
    expect(screen.getByRole('slider', { name: 'Tuần thai' })).toHaveProperty('value', '28');
  });
});
