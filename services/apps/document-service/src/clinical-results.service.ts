import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GrpcClientFactory, type PublicAuthContext } from '@platform';
import { createHash, randomUUID } from 'node:crypto';
import { DocumentPrismaService } from './database/prisma.service';

const PURPOSE = 'CLINICAL_RESULT_FILE';
const MAX_BYTES = 5 * 1024 * 1024;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class ClinicalResultsService {
  constructor(
    private readonly db: DocumentPrismaService,
    private readonly config: ConfigService,
    private readonly grpc: GrpcClientFactory,
  ) {}

  private async authorize(
    encounterId: string,
    auth: PublicAuthContext,
    write = false,
  ) {
    if (auth.role !== 'DOCTOR') throw new ForbiddenException('DOCTOR_REQUIRED');
    if (!UUID.test(encounterId))
      throw new BadRequestException('INVALID_ENCOUNTER_ID');
    try {
      const doctor = this.grpc.client({
        key: 'clinical-file-doctor',
        target:
          this.config.get<string>('DOCTOR_GRPC_TARGET') ??
          'doctor-service:6005',
        proto: 'doctor/v1/doctor_internal.proto',
        package: 'maternal.doctor.v1',
        service: 'DoctorInternalService',
      });
      const resolved = await this.grpc.unary<any, any>(
        doctor,
        'resolveDoctorByAccount',
        { accountId: auth.userId },
        this.grpc.metadata('doctor-service', ['doctor:internal:read']),
      );
      if (!resolved.found || !resolved.doctorId)
        throw new ForbiddenException('DOCTOR_PROFILE_NOT_FOUND');
      const medical = this.grpc.client({
        key: 'clinical-file-medical',
        target:
          this.config.get<string>('MEDICAL_RECORD_GRPC_TARGET') ??
          'medical-record-service:6011',
        proto: 'medical_record/v1/medical_record_internal.proto',
        package: 'maternal.medical_record.v1',
        service: 'MedicalRecordInternalService',
      });
      const access = await this.grpc.unary<any, any>(
        medical,
        'validateEncounterAccess',
        {
          encounterId,
          doctorId: resolved.doctorId,
          requestedAction: write ? 'WRITE' : 'READ',
          purpose: PURPOSE,
        },
        this.grpc.metadata('medical-record-service', [
          'medical:access:validate',
        ]),
      );
      if (!access.allowed || !access.encounter?.patientId)
        throw new ForbiddenException('NOT_ASSIGNED');
      if (write && access.encounter.state !== 'ENCOUNTER_STATE_IN_PROGRESS')
        throw new ForbiddenException('ENCOUNTER_NOT_IN_PROGRESS');
      return access.encounter;
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new ServiceUnavailableException('CLINICAL_ACCESS_UNAVAILABLE');
    }
  }

  async list(encounterId: string, auth: PublicAuthContext) {
    await this.authorize(encounterId, auth);
    const rows = await this.db.document.findMany({
      where: {
        ownerType: 'ENCOUNTER',
        ownerId: encounterId,
        purpose: PURPOSE,
        status: 'UPLOADED',
      },
      include: {
        versions: {
          select: { fileName: true, mediaType: true, sizeBytes: true },
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return {
      data: rows.map((row) => ({
        id: row.id,
        createdAt: row.createdAt,
        fileName: row.versions[0]?.fileName,
        mediaType: row.versions[0]?.mediaType,
        sizeBytes: Number(row.versions[0]?.sizeBytes ?? 0),
      })),
    };
  }

  async upload(encounterId: string, body: any, auth: PublicAuthContext) {
    const encounter = await this.authorize(encounterId, auth, true);
    if (
      typeof body?.contentBase64 !== 'string' ||
      body.contentBase64.length > Math.ceil(MAX_BYTES / 3) * 4 ||
      body.contentBase64.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(body.contentBase64)
    )
      throw new BadRequestException('INVALID_FILE');
    const bytes = Buffer.from(body.contentBase64, 'base64');
    if (!bytes.length || bytes.length > MAX_BYTES)
      throw new BadRequestException('INVALID_FILE_SIZE');
    if (bytes.toString('base64') !== body.contentBase64)
      throw new BadRequestException('INVALID_FILE');
    const type =
      bytes.subarray(0, 5).toString() === '%PDF-'
        ? 'application/pdf'
        : bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
          ? 'image/png'
          : bytes.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'))
            ? 'image/jpeg'
            : null;
    if (!type || body.mediaType !== type)
      throw new BadRequestException('UNSUPPORTED_FILE_TYPE');
    const fileName =
      typeof body.fileName === 'string'
        ? body.fileName
            .replace(/[\\/\x00-\x1f\x7f]/g, '_')
            .trim()
            .slice(0, 200)
        : '';
    if (!fileName) throw new BadRequestException('FILE_NAME_REQUIRED');
    const id = randomUUID();
    await this.db.document.create({
      data: {
        id,
        ownerType: 'ENCOUNTER',
        ownerId: encounterId,
        patientId: encounter.patientId,
        purpose: PURPOSE,
        status: 'UPLOADED',
        createdByAccountId: auth.userId,
        versions: {
          create: {
            version: 1,
            storageKey: `clinical-results/${id}/1`,
            fileName,
            mediaType: type,
            sizeBytes: bytes.length,
            sha256: createHash('sha256').update(bytes).digest('hex'),
            content: bytes,
            scanStatus: 'PENDING',
            uploadedAt: new Date(),
          },
        },
      },
    });
    return { data: { id, fileName, mediaType: type, sizeBytes: bytes.length } };
  }

  async content(encounterId: string, id: string, auth: PublicAuthContext) {
    await this.authorize(encounterId, auth);
    if (!UUID.test(id)) throw new NotFoundException('FILE_NOT_FOUND');
    const doc = await this.db.document.findFirst({
      where: {
        id,
        ownerType: 'ENCOUNTER',
        ownerId: encounterId,
        purpose: PURPOSE,
        status: 'UPLOADED',
      },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    const version = doc?.versions[0];
    if (!version?.content) throw new NotFoundException('FILE_NOT_FOUND');
    return {
      content: Buffer.from(version.content),
      mediaType: version.mediaType,
      fileName: version.fileName,
    };
  }
}
