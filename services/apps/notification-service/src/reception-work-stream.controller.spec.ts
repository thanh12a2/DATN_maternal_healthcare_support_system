import { ForbiddenException } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import { NotificationController } from './notification.controller';
import jwt from 'jsonwebtoken';

describe('reception work SSE authorization', () => {
  it('rejects patients and cleans up a receptionist subscription', () => {
    const unsubscribe = jest.fn();
    let callback!: (category: string) => void;
    const stream = { subscribe: jest.fn((listener: (category: string) => void) => { callback = listener; return unsubscribe; }) };
    const controller = new NotificationController({} as any, {} as any, stream as any);
    const response = Object.assign(new EventEmitter(), { status: jest.fn(), setHeader: jest.fn(), flushHeaders: jest.fn(), write: jest.fn() });
    expect(() => controller.stream({ role: 'PATIENT' } as any, response as any)).toThrow(ForbiddenException);
    controller.stream({ role: 'RECEPTIONIST' } as any, response as any);
    callback('case');
    expect(response.write).toHaveBeenCalledWith(expect.stringContaining('"category":"case"'));
    response.emit('close');
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe('personal inbox SSE authorization', () => {
  it('uses the authenticated account and cleans up on disconnect', () => {
    const unsubscribe = jest.fn();
    const stream = { subscribeAccount: jest.fn(() => unsubscribe) };
    const controller = new NotificationController({} as any, {} as any, stream as any);
    const response = Object.assign(new EventEmitter(), { status: jest.fn(), setHeader: jest.fn(), flushHeaders: jest.fn(), write: jest.fn() });
    expect(() => controller.personalStream({ userId: 'other', role: 'RECEPTIONIST' } as any, response as any)).toThrow(ForbiddenException);
    controller.personalStream({ userId: 'patient-account', role: 'PATIENT' } as any, response as any);
    expect(stream.subscribeAccount).toHaveBeenCalledWith('patient-account', expect.any(Function));
    response.emit('close'); expect(unsubscribe).toHaveBeenCalledTimes(1);
    controller.personalStream({ userId: 'doctor-account', role: 'DOCTOR' } as any, response as any);
    expect(stream.subscribeAccount).toHaveBeenCalledWith('doctor-account', expect.any(Function));
    response.emit('close'); expect(unsubscribe).toHaveBeenCalledTimes(2);
  });
  it('closes the connection when the verified access token expires', () => {
    jest.useFakeTimers();
    try {
      const controller = new NotificationController({} as any, {} as any, { subscribeAccount: jest.fn(() => jest.fn()) } as any);
      const response = Object.assign(new EventEmitter(), { status: jest.fn(), setHeader: jest.fn(), flushHeaders: jest.fn(), write: jest.fn(), end: jest.fn() });
      const token = jwt.sign({ role: 'PATIENT' }, 'test', { subject: 'account', expiresIn: 2 });
      controller.personalStream({ userId: 'account', role: 'PATIENT' } as any, response as any, { headers: { authorization: `Bearer ${token}` } } as any);
      jest.advanceTimersByTime(3000);
      expect(response.end).toHaveBeenCalledTimes(1);
      response.emit('close');
    } finally { jest.useRealTimers(); }
  });
});
