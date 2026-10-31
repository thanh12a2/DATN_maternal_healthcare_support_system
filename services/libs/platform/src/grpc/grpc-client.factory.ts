import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { credentials, loadPackageDefinition, Metadata, type ChannelCredentials, type Client } from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import { protoPath, protoRoot } from './proto-path';
import { ServiceTokenService } from './service-token.service';

interface ClientConstructor { new(address: string, channelCredentials: ChannelCredentials): Client }
@Injectable()
export class GrpcClientFactory implements OnModuleDestroy {
  private readonly clients = new Map<string, Client>();
  constructor(private readonly config: ConfigService, private readonly tokens: ServiceTokenService) {}

  client(input: { key: string; target: string; proto: string; package: string; service: string }): Client {
    const cached=this.clients.get(input.key); if(cached) return cached;
    const definition=loadSync(protoPath(input.proto),{includeDirs:[protoRoot()],longs:String,enums:String,defaults:true,oneofs:true});
    let node:any=loadPackageDefinition(definition);
    for(const part of input.package.split('.')) node=node[part];
    const Constructor=node[input.service] as ClientConstructor;
    const client=new Constructor(input.target,credentials.createInsecure());
    this.clients.set(input.key,client); return client;
  }

  metadata(audience: string, scopes: string[], context?: { requestId?: string; correlationId?: string; idempotencyKey?: string }): Metadata {
    const metadata=new Metadata();
    const serviceId=this.config.get<string>('SERVICE_ID') ?? 'unknown-service';
    metadata.set('authorization','Bearer '+this.tokens.sign({serviceId,audience,scopes}));
    if(context?.requestId) metadata.set('x-request-id',context.requestId);
    if(context?.correlationId) metadata.set('x-correlation-id',context.correlationId);
    if(context?.idempotencyKey) metadata.set('x-idempotency-key',context.idempotencyKey);
    return metadata;
  }

  unary<TReq,TRes>(client: Client, method: string, request: TReq, metadata: Metadata, deadlineMs=2000): Promise<TRes> {
    return new Promise((resolve,reject)=>{
      const fn=(client as any)[method]?.bind(client);
      if(!fn) return reject(new Error('Missing gRPC method: '+method));
      fn(request,metadata,{deadline:Date.now()+deadlineMs},(error:Error|null,response:TRes)=>error?reject(error):resolve(response));
    });
  }
  onModuleDestroy(): void { for(const client of this.clients.values()) client.close(); this.clients.clear(); }
}
