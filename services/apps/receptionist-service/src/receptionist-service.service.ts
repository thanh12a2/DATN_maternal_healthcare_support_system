import { Injectable } from '@nestjs/common';

@Injectable()
export class ReceptionistServiceService {
  getHealth(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
