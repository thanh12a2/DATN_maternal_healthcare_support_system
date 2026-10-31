import { randomUUID } from 'node:crypto';
import { Server, ServerCredentials, loadPackageDefinition } from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import { ConfigService } from '@nestjs/config';
import { GrpcClientFactory, protoPath, protoRoot } from '@platform';
import { AppointmentPrismaService } from '../../../appointment-service/src/database/prisma.service';
import { AppointmentDomainService } from '../../../appointment-service/src/appointments/appointment.service';
import { AppointmentGrpcController } from '../../../appointment-service/src/appointments/appointment-grpc.controller';
import { MedicalPrismaService } from '../database/prisma.service';
import { MedicalDomainService } from './medical.service';
import { DoctorIdentityGateway } from './doctor-identity.gateway';
import { AppointmentSyncService } from './appointment-sync.service';
import { PrismaService as DoctorPrismaService } from '../../../doctor-service/src/database/prisma.service';
import { DoctorDomainService } from '../../../doctor-service/src/doctors/doctor.service';
import { DoctorGrpcController } from '../../../doctor-service/src/grpc/doctor-grpc.controller';

const integration = process.env.DOCTOR_SYNC_ISOLATED_TEST === '1' ? describe : describe.skip;

integration('encounter and appointment synchronization on isolated PostgreSQL', () => {
  it('persists and retries start, then synchronizes completion over real gRPC', async () => {
    const appointments = new AppointmentPrismaService();
    const medical = new MedicalPrismaService();
    const doctors = new DoctorPrismaService();
    const service = new AppointmentDomainService(appointments, {} as any);
    const controller = new AppointmentGrpcController(service);
    const definition = loadSync(protoPath('appointment/v1/appointment_internal.proto'), { includeDirs: [protoRoot()], longs: String, enums: String, defaults: true, oneofs: true });
    const proto: any = loadPackageDefinition(definition);
    const serviceDefinition = proto.maternal.appointment.v1.AppointmentInternalService.service;
    let server: Server | undefined;
    let doctorServer: Server | undefined;
    const listen = async (address: string) => {
      const next = new Server();
      next.addService(serviceDefinition, {
        getAppointment: (call: any, done: any) => { void controller.getAppointment(call.request).then((result) => done(null, result), done); },
        markClinicalStarted: (call: any, done: any) => { void controller.markClinicalStarted(call.request).then((result) => done(null, result), done); },
        markClinicalCompleted: (call: any, done: any) => { void controller.markClinicalCompleted(call.request).then((result) => done(null, result), done); },
      });
      const port = await new Promise<number>((resolve, reject) => next.bindAsync(address, ServerCredentials.createInsecure(), (error, bound) => error ? reject(error) : resolve(bound)));
      server = next; return port;
    };
    try {
      const port = await listen('127.0.0.1:0');
      const doctorDefinition = loadSync(protoPath('doctor/v1/doctor_internal.proto'), { includeDirs: [protoRoot()], longs: String, enums: String, defaults: true, oneofs: true });
      const doctorProto: any = loadPackageDefinition(doctorDefinition);
      const doctorController = new DoctorGrpcController(new DoctorDomainService(doctors, {} as any, {} as any));
      doctorServer = new Server();
      doctorServer.addService(doctorProto.maternal.doctor.v1.DoctorInternalService.service, { resolveDoctorByAccount: (call: any, done: any) => { void doctorController.resolveDoctorByAccount(call.request).then((result) => done(null, result), done); } });
      const doctorPort = await new Promise<number>((resolve, reject) => doctorServer!.bindAsync('127.0.0.1:0', ServerCredentials.createInsecure(), (error, bound) => error ? reject(error) : resolve(bound)));
      const config = new ConfigService({ APPOINTMENT_GRPC_TARGET: `127.0.0.1:${port}`, DOCTOR_GRPC_TARGET: `127.0.0.1:${doctorPort}`, SERVICE_ID: 'medical-record-service' });
      const grpc = new GrpcClientFactory(config, { sign: () => 'test-token' } as any);
      const gateway = new DoctorIdentityGateway(config, grpc);
      const encounterService = new MedicalDomainService(medical, gateway);
      const sync = new AppointmentSyncService(medical, gateway);
      const appointmentId = randomUUID(), encounterId = randomUUID(), doctorId = randomUUID(), patientId = randomUUID(), actorId = randomUUID(), otherDoctorId = randomUUID(), otherAccountId = randomUUID();
      const start = new Date('2026-01-01T01:00:00Z');
      await doctors.doctor.create({ data: { id: doctorId, accountId: actorId, licenseNumber: randomUUID() } });
      await doctors.doctor.create({ data: { id: otherDoctorId, accountId: otherAccountId, licenseNumber: randomUUID() } });
      await appointments.appointment.create({ data: { id: appointmentId, appointmentCode: `T${randomUUID().slice(0, 8)}`, patientId, serviceId: randomUUID(), channel: 'ONLINE', selectionMode: 'DOCTOR', assignedDoctorId: doctorId, assignedRankCode: 'BASIC', specialtyId: randomUUID(), startAt: start, endAt: new Date(start.getTime() + 1800000), status: 'CHECKED_IN', encounterId, serviceNameSnapshot: 'Kiểm thử', serviceVersion: 1, basePriceId: randomUUID(), baseAmountMinor: 0n, rankSurchargeAmountMinor: 0n, estimatedTotalMinor: 0n, availabilityVersion: 1n } });
      await medical.clinicalEncounter.create({ data: { id: encounterId, appointmentId, patientId, primaryDoctorId: doctorId, assignments: { create: { staffId: doctorId, role: 'PRIMARY', status: 'ACTIVE' } } } });
      await expect(encounterService.start(encounterId, 1, otherAccountId, 'DOCTOR')).rejects.toThrow('NOT_ASSIGNED');
      await encounterService.start(encounterId, 1, actorId, 'DOCTOR');
      await expect(encounterService.ready(encounterId, 2, actorId, 'DOCTOR')).rejects.toThrow('INVALID_STATE_TRANSITION');
      server!.forceShutdown(); server = undefined;
      await sync.flush();
      const failed = await medical.encounterAppointmentSync.findFirstOrThrow({ where: { encounterId, action: 'START' } });
      expect(failed.status).toBe('PENDING'); expect(failed.attempts).toBe(1);
      await listen(`127.0.0.1:${port}`);
      await medical.encounterAppointmentSync.update({ where: { id: failed.id }, data: { nextAttemptAt: new Date(0) } });
      grpc.onModuleDestroy();
      const retryGrpc = new GrpcClientFactory(config, { sign: () => 'test-token' } as any);
      const retryGateway = new DoctorIdentityGateway(config, retryGrpc);
      const retrySync = new AppointmentSyncService(medical, retryGateway);
      const retryEncounterService = new MedicalDomainService(medical, retryGateway);
      await retrySync.flush();
      expect((await appointments.appointment.findUniqueOrThrow({ where: { id: appointmentId } })).status).toBe('IN_CLINICAL_CARE');
      expect((await medical.encounterAppointmentSync.findUniqueOrThrow({ where: { id: failed.id } })).status).toBe('DONE');
      await retryEncounterService.ready(encounterId, 2, actorId, 'DOCTOR');
      await retryEncounterService.finalize(encounterId, 3, actorId, 'DOCTOR');
      await retrySync.flush();
      expect((await appointments.appointment.findUniqueOrThrow({ where: { id: appointmentId } })).status).toBe('COMPLETED');
      expect((await medical.clinicalEncounter.findUniqueOrThrow({ where: { id: encounterId } })).state).toBe('FINALIZED');
      retryGrpc.onModuleDestroy();
    } finally { server?.forceShutdown(); doctorServer?.forceShutdown(); await appointments.$disconnect(); await medical.$disconnect(); await doctors.$disconnect(); }
  }, 30000);
});
