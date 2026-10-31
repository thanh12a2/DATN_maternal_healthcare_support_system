import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  CurrentAuth,
  PublicHttp,
  PublicJwtGuard,
  ServiceJwtGuard,
  ServiceScopes,
  type PublicAuthContext,
} from '@platform';
import { DocumentService } from './document.service';

@Controller()
export class DocumentController {
  constructor(private readonly s: DocumentService) {}

  @PublicHttp()
  @Get('health')
  health() {
    return { status: 'ok' };
  }

  // ─── REST Endpoints ────────────────────────────────────────────────────────

  @UseGuards(PublicJwtGuard)
  @Post(['uploads', 'documents/uploads'])
  createUpload(
    @Body() b: any,
    @Headers('idempotency-key') idempotencyKeyHeader: string,
    @CurrentAuth() auth: PublicAuthContext,
  ) {
    return this.s.createRest(b, idempotencyKeyHeader, auth);
  }

  @UseGuards(PublicJwtGuard)
  @Post(['uploads/:id/complete', 'documents/uploads/:id/complete'])
  completeUpload(
    @Param('id') sessionId: string,
    @Body() b: any,
    @Headers('idempotency-key') idempotencyKeyHeader: string,
    @CurrentAuth() auth: PublicAuthContext,
  ) {
    return this.s.completeRest(sessionId, b, idempotencyKeyHeader, auth);
  }

  @UseGuards(PublicJwtGuard)
  @Get([':id/download', 'documents/:id/download'])
  getDownloadUrl(
    @Param('id') documentId: string,
    @CurrentAuth() auth: PublicAuthContext,
  ) {
    return this.s.getDownloadUrlRest(documentId, auth);
  }

  @PublicHttp()
  @Get([
    ':id/content',
    'documents/:id/content',
    'api/documents/:id/content',
    'content/:id',
    'documents/content/:id',
    'api/documents/content/:id',
  ])
  getContent(
    @Param('id') documentId: string,
    @Req() req: any,
    @Res() res: any,
  ) {
    return this.s.getContent(documentId, req, res);
  }

  @UseGuards(PublicJwtGuard)
  @Post([':id/versions', 'documents/:id/versions'])
  createVersion(
    @Param('id') documentId: string,
    @Body() b: any,
    @Headers('idempotency-key') idempotencyKeyHeader: string,
    @CurrentAuth() auth: PublicAuthContext,
  ) {
    return this.s.createVersionRest(documentId, b, idempotencyKeyHeader, auth);
  }

  @UseGuards(PublicJwtGuard)
  @Post([':id/archive', 'documents/:id/archive'])
  archiveDocument(
    @Param('id') documentId: string,
    @Body() b: any,
    @CurrentAuth() auth: PublicAuthContext,
  ) {
    return this.s.archiveRest(documentId, b, auth);
  }

  @UseGuards(PublicJwtGuard)
  @Get([':id', 'documents/:id'])
  getDocument(
    @Param('id') documentId: string,
    @CurrentAuth() auth: PublicAuthContext,
  ) {
    return this.s.getDocumentRest(documentId, auth);
  }

  // ─── gRPC Endpoints ────────────────────────────────────────────────────────

  @UseGuards(ServiceJwtGuard)
  @GrpcMethod('DocumentInternalService', 'CreateDocumentUpload')
  @ServiceScopes('document:write')
  create(r: any) {
    return this.s.create(r);
  }

  @UseGuards(ServiceJwtGuard)
  @GrpcMethod('DocumentInternalService', 'LinkDocument')
  @ServiceScopes('document:write')
  link(r: any) {
    return this.s.link(r);
  }

  @UseGuards(ServiceJwtGuard)
  @GrpcMethod('DocumentInternalService', 'ListDocumentsByOwner')
  @ServiceScopes('document:read')
  list(r: any) {
    return this.s.list(r);
  }

  @UseGuards(ServiceJwtGuard)
  @GrpcMethod('DocumentInternalService', 'GetDocumentAccess')
  @ServiceScopes('document:read')
  access(r: any) {
    return this.s.access(r);
  }

  @UseGuards(ServiceJwtGuard)
  @GrpcMethod('DocumentInternalService', 'ArchiveDocumentsByOwner')
  @ServiceScopes('document:write')
  archive(r: any) {
    return this.s.archive(r);
  }
}
