import type { INestApplication } from '@nestjs/common';
import { Transport, type MicroserviceOptions } from '@nestjs/microservices';
import { protoPath, protoRoot } from './proto-path';

export interface GrpcServerDefinition {
  package: string | string[];
  proto: string | string[];
  url: string;
}

export function connectGrpcServer(app: INestApplication, definition: GrpcServerDefinition): void {
  const proto = Array.isArray(definition.proto)
    ? definition.proto.map((item) => protoPath(item))
    : protoPath(definition.proto);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: definition.package,
      protoPath: proto,
      url: definition.url,
      loader: {
        includeDirs: [protoRoot()],
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      },
    },
  });
}
