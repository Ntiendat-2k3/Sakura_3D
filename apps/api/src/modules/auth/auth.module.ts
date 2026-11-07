import { Module } from '@nestjs/common';
import { GUEST_REPOSITORY, type GuestRepository } from './domain/guest.repository';
import { SESSION_ISSUER, type SessionIssuer } from './application/session-issuer.port';
import { CreateGuestSessionUseCase } from './application/create-guest-session.use-case';
import { SequelizeGuestRepository } from './infrastructure/sequelize-guest.repository';
import { JoseSessionIssuer } from './infrastructure/jose-session.issuer';
import { AuthController } from './presentation/auth.controller';
@Module({
  controllers: [AuthController],
  providers: [
    { provide: GUEST_REPOSITORY, useClass: SequelizeGuestRepository },
    { provide: SESSION_ISSUER, useClass: JoseSessionIssuer },
    { provide: CreateGuestSessionUseCase, useFactory: (repo: GuestRepository, issuer: SessionIssuer) => new CreateGuestSessionUseCase(repo, issuer), inject: [GUEST_REPOSITORY, SESSION_ISSUER] },
  ],
})
export class AuthModule {}
