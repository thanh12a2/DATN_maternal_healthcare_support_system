import { beforeEach, describe, expect, it } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { PasswordHasherService } from './password-hasher.service';

const PASSWORD = 'Str0ngPassword!';

describe('PasswordHasherService', () => {
  let passwordHasherService: PasswordHasherService;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [PasswordHasherService],
    }).compile();

    passwordHasherService = moduleRef.get<PasswordHasherService>(PasswordHasherService);
  });

  it('should hash password with Argon2id metadata', async () => {
    const passwordHash = await passwordHasherService.hashPassword(PASSWORD);

    expect(passwordHash).not.toBe(PASSWORD);
    expect(passwordHash).toContain('$argon2id$');
  });

  it('should generate different hashes for the same password because each hash has its own salt', async () => {
    const firstHash = await passwordHasherService.hashPassword(PASSWORD);
    const secondHash = await passwordHasherService.hashPassword(PASSWORD);

    expect(firstHash).not.toBe(secondHash);
  });

  it('should verify the correct password', async () => {
    const passwordHash = await passwordHasherService.hashPassword(PASSWORD);

    await expect(passwordHasherService.verifyPassword(passwordHash, PASSWORD)).resolves.toBe(true);
  });

  it('should reject an incorrect password', async () => {
    const passwordHash = await passwordHasherService.hashPassword(PASSWORD);

    await expect(passwordHasherService.verifyPassword(passwordHash, 'WrongPassword!')).resolves.toBe(false);
  });
});
