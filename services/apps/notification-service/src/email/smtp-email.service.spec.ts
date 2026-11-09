import nodemailer from 'nodemailer';
import { SmtpEmailService } from './smtp-email.service';

jest.mock('nodemailer', () => ({ __esModule: true, default: { createTransport: jest.fn() } }));

describe('notification SMTP sender', () => {
  const sendMail = jest.fn();
  const close = jest.fn();
  const values: Record<string, string> = { NOTIFICATION_SMTP_HOST: 'localhost', NOTIFICATION_EMAIL_FROM: 'clinic@example.test' };
  const service = new SmtpEmailService({ get: (key: string) => values[key] } as any);
  beforeEach(() => { jest.clearAllMocks(); (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail, close }); });
  it('sends the actual attachment and closes the transport', async () => {
    sendMail.mockResolvedValue({ accepted: ['patient@example.test'], messageId: 'message' });
    await expect(service.send('patient@example.test', { subject: 'Result', text: 'text', html: '<p>text</p>' }, '<event@example.test>', [{ fileName: '../result.pdf', mediaType: 'application/pdf', content: Buffer.from('test') }])).resolves.toEqual({ providerMessageId: 'message' });
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'patient@example.test', attachments: [expect.objectContaining({ filename: '.._result.pdf', content: Buffer.from('test') })] }));
    expect(close).toHaveBeenCalledTimes(1);
  });
  it('does not treat a rejected recipient as successfully sent', async () => {
    sendMail.mockResolvedValue({ accepted: [], rejected: ['patient@example.test'] });
    await expect(service.send('patient@example.test', { subject: 'Result', text: '', html: '' }, '<event@example.test>')).rejects.toThrow('SMTP_RECIPIENT_REJECTED');
    expect(close).toHaveBeenCalledTimes(1);
  });
  it('rejects invalid recipients and oversized attachments before sending', async () => {
    await expect(service.send('a@example.test\r\nBcc:b@example.test', { subject: '', text: '', html: '' }, 'id')).rejects.toThrow('INVALID_EMAIL_RECIPIENT');
    await expect(service.send('patient@example.test', { subject: '', text: '', html: '' }, 'id', [{ fileName: 'x', mediaType: 'application/pdf', content: Buffer.alloc(10 * 1024 * 1024 + 1) }])).rejects.toThrow('EMAIL_ATTACHMENTS_TOO_LARGE');
    expect(sendMail).not.toHaveBeenCalled();
  });
});
