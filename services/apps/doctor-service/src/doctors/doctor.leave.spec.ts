import { DoctorDomainService } from './doctor.service';

describe('doctor shift leave safety', () => {
  const from = new Date('2026-11-29T02:00:00.000Z');
  const to = new Date('2026-11-29T03:00:00.000Z');
  let service: DoctorDomainService;

  beforeEach(() => {
    service = Object.create(DoctorDomainService.prototype) as DoctorDomainService;
    Object.assign(service, { config: { get: () => 'http://appointment-service:5008' } });
  });
  afterEach(() => jest.restoreAllMocks());

  it('refuses approval while an active appointment overlaps the shift', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async (url) => ({
      ok: true,
      json: async () => ({ items: String(url).includes('status=BOOKED')
        ? [{ startAt: '2026-11-29T02:30:00.000Z', endAt: '2026-11-29T03:00:00.000Z' }] : [] }),
    } as Response));
    await expect((service as any).assertNoAppointmentsInWindow('doctor-id', from, to, 'Bearer manager'))
      .rejects.toMatchObject({ status: 409 });
    expect(global.fetch).toHaveBeenCalledTimes(4);
  });

  it('fails closed if appointment data is unavailable or pagination loops', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false } as Response);
    await expect((service as any).assertNoAppointmentsInWindow('doctor-id', from, to, 'Bearer manager'))
      .rejects.toMatchObject({ status: 503 });
    jest.restoreAllMocks();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true, json: async () => ({ items: [], nextPageToken: 'more' }),
    } as Response);
    await expect((service as any).assertNoAppointmentsInWindow('doctor-id', from, to, 'Bearer manager'))
      .rejects.toMatchObject({ status: 503 });
  });

  it('allows approval when no appointment overlaps the shift', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true, json: async () => ({ items: [] }),
    } as Response);
    await expect((service as any).assertNoAppointmentsInWindow('doctor-id', from, to, 'Bearer manager'))
      .resolves.toBeUndefined();
  });

  it('checks all appointment pages before allowing approval', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (url) => ({
      ok: true, json: async () => String(url).includes('cursor=page-2')
        ? { items: [], nextPageToken: null }
        : { items: [], nextPageToken: 'page-2' },
    } as Response));
    await expect((service as any).assertNoAppointmentsInWindow('doctor-id', from, to, 'Bearer manager'))
      .resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(8);
  });
});
