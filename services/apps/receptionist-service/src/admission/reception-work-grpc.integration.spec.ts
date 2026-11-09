import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { Transport } from '@nestjs/microservices';
import { Metadata } from '@grpc/grpc-js';
import { generateKeyPairSync } from 'node:crypto';
import { createServer } from 'node:net';
import { GrpcClientFactory, PlatformModule, ServiceTokenService, protoPath, protoRoot } from '@platform';
import { ReceptionWorkGrpcController } from './reception-work-grpc.controller';
import { ReceptionWorkService } from './reception-work.service';

const enabled = process.env.RECEPTION_GRPC_INTEGRATION === '1';
(enabled ? describe : describe.skip)('reception work gRPC authorization', () => {
  it('accepts an authorized billing caller and rejects other services', async () => {
    const keys = generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
    const config = { INTERNAL_SERVICE_JWT_PRIVATE_KEY: keys.privateKey, INTERNAL_SERVICE_JWT_PUBLIC_KEY: keys.publicKey, INTERNAL_SERVICE_JWT_AUDIENCE: 'receptionist-service', SERVICE_ID: 'billing-service' };
    const temporary = createServer();
    const port = await new Promise<number>((resolve, reject) => { temporary.once('error', reject); temporary.listen(0, '127.0.0.1', () => resolve((temporary.address() as { port: number }).port)); });
    await new Promise<void>(resolve => temporary.close(() => resolve()));
    const module = await Test.createTestingModule({ imports: [ConfigModule.forRoot({ isGlobal: true, load: [() => config] }), PlatformModule], controllers: [ReceptionWorkGrpcController], providers: [{ provide: ReceptionWorkService, useValue: { getAppointmentOwner: jest.fn().mockResolvedValue({ hasActiveCase: true, ownerAccountId: 'owner' }) } }] }).compile();
    const app = module.createNestMicroservice({ transport: Transport.GRPC, options: { package: 'maternal.receptionist.v1', protoPath: protoPath('receptionist/v1/reception_work_internal.proto'), url: `127.0.0.1:${port}`, loader: { includeDirs: [protoRoot()] } } });
    const grpc = module.get(GrpcClientFactory), tokens = module.get(ServiceTokenService);
    try {
      await app.listen();
      const client = grpc.client({ key: 'reception-test', target: `127.0.0.1:${port}`, proto: 'receptionist/v1/reception_work_internal.proto', package: 'maternal.receptionist.v1', service: 'ReceptionWorkInternalService' });
      const valid = grpc.metadata('receptionist-service', ['reception:work:read']);
      await expect(grpc.unary(client, 'getAppointmentOwner', { appointmentId: 'test' }, valid)).resolves.toEqual(expect.objectContaining({ hasActiveCase: true, ownerAccountId: 'owner' }));
      const invalid = new Metadata();
      invalid.set('authorization', 'Bearer ' + tokens.sign({ serviceId: 'patient-service', audience: 'receptionist-service', scopes: ['reception:work:read'] }));
      await expect(grpc.unary(client, 'getAppointmentOwner', { appointmentId: 'test' }, invalid)).rejects.toThrow();
    } finally { await app.close(); await grpc.onModuleDestroy(); }
  }, 30000);
});
