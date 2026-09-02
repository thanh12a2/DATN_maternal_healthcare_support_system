import { Test, TestingModule } from '@nestjs/testing';
import { ReceptionistServiceController } from './receptionist-service.controller';
import { ReceptionistServiceService } from './receptionist-service.service';

describe('ReceptionistServiceController', () => {
  let receptionistServiceController: ReceptionistServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ReceptionistServiceController],
      providers: [ReceptionistServiceService],
    }).compile();

    receptionistServiceController = app.get<ReceptionistServiceController>(
      ReceptionistServiceController,
    );
  });

  describe('health', () => {
    it('should report healthy', () => {
      expect(receptionistServiceController.getHealth()).toEqual({
        status: 'ok',
      });
    });
  });
});
