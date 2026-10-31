import { Test } from '@nestjs/testing';
import { describe, expect, it } from '@jest/globals';
import { DoctorServiceController } from './doctor-service.controller';
import { DoctorServiceService } from './doctor-service.service';

describe('DoctorServiceController', () => {
  it('returns the health contract', async () => {
    const module = await Test.createTestingModule({
      controllers: [DoctorServiceController],
      providers: [
        {
          provide: DoctorServiceService,
          useValue: { getHealth: async () => ({ status: 'ok' }) },
        },
      ],
    }).compile();
    await expect(module.get(DoctorServiceController).health()).resolves.toEqual(
      { status: 'ok' },
    );
  });
});
