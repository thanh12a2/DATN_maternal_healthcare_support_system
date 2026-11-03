import { BadRequestException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { ClinicalResultsService } from './clinical-results.service';

describe('ClinicalResultsService', () => {
  const encounterId = '10000000-0000-4000-8000-000000000001';
  const doctor = { role: 'DOCTOR', userId: 'account' };
  const db = { document: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() } };
  const grpc = { client: jest.fn().mockReturnValue({}), metadata: jest.fn().mockReturnValue({}), unary: jest.fn() };
  const service = new ClinicalResultsService(db as any, { get: jest.fn() } as any, grpc as any);
  const pdf = Buffer.from('%PDF-1.4 example');
  beforeEach(() => {
    jest.clearAllMocks();
    grpc.unary.mockImplementation((_client, method) => method === 'resolveDoctorByAccount' ? Promise.resolve({ found: true, doctorId: 'doctor-id' }) : Promise.resolve({ allowed: true, encounter: { patientId: 'patient-id', state: 'ENCOUNTER_STATE_IN_PROGRESS' } }));
  });

  it('stores actual bytes under the patient and encounter returned by medical service', async () => {
    db.document.create.mockResolvedValue({});
    await service.upload(encounterId, { fileName: 'ket-qua.pdf', mediaType: 'application/pdf', contentBase64: pdf.toString('base64') }, doctor);
    const data = db.document.create.mock.calls[0][0].data;
    expect(data.patientId).toBe('patient-id');
    expect(data.ownerId).toBe(encounterId);
    expect(data.versions.create.content).toEqual(pdf);
    expect(data.versions.create.scanStatus).toBe('PENDING');
  });

  it('rejects unassigned doctors without saving bytes', async () => {
    grpc.unary.mockImplementation((_client, method) => Promise.resolve(method === 'resolveDoctorByAccount' ? { found: true, doctorId: 'other' } : { allowed: false }));
    await expect(service.upload(encounterId, { fileName: 'x.pdf', mediaType: 'application/pdf', contentBase64: pdf.toString('base64') }, doctor)).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.document.create).not.toHaveBeenCalled();
  });

  it('rejects uploads for finalized encounters and files with mismatched content', async () => {
    grpc.unary.mockImplementation((_client, method) => Promise.resolve(method === 'resolveDoctorByAccount' ? { found: true, doctorId: 'doctor-id' } : { allowed: true, encounter: { patientId: 'patient-id', state: 'ENCOUNTER_STATE_FINALIZED' } }));
    await expect(service.upload(encounterId, { fileName: 'x.pdf', mediaType: 'application/pdf', contentBase64: pdf.toString('base64') }, doctor)).rejects.toBeInstanceOf(ForbiddenException);
    grpc.unary.mockImplementation((_client, method) => Promise.resolve(method === 'resolveDoctorByAccount' ? { found: true, doctorId: 'doctor-id' } : { allowed: true, encounter: { patientId: 'patient-id', state: 'ENCOUNTER_STATE_IN_PROGRESS' } }));
    await expect(service.upload(encounterId, { fileName: 'x.png', mediaType: 'image/png', contentBase64: pdf.toString('base64') }, doctor)).rejects.toBeInstanceOf(BadRequestException);
    expect(db.document.create).not.toHaveBeenCalled();
  });

  it('fails closed when a dependency cannot verify access', async () => {
    grpc.unary.mockRejectedValue(new Error('unavailable'));
    await expect(service.list(encounterId, doctor)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(db.document.findMany).not.toHaveBeenCalled();
  });

  it('does not return a file when it is not part of the requested encounter', async () => {
    db.document.findFirst.mockResolvedValue(null);
    await expect(service.content(encounterId, '20000000-0000-4000-8000-000000000001', doctor)).rejects.toThrow('FILE_NOT_FOUND');
    expect(db.document.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ ownerId: encounterId, purpose: 'CLINICAL_RESULT_FILE' }) }));
  });
});
