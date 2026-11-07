import { Controller, ForbiddenException, HttpCode, Post } from '@nestjs/common';
import { CreateGuestSessionUseCase } from '../application/create-guest-session.use-case';
// Demo-only endpoint. Real launch requires an age assurance, account and abuse-prevention design.
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly createGuest: CreateGuestSessionUseCase) {}
  @Post('guest')
  @HttpCode(201)
  async guest() {
    if (process.env.NODE_ENV === 'production') throw new ForbiddenException('Guest demo sign-in disabled in production');
    // Not an IP-based rate limiter: each browser creates a new guest per reload.
    // Public deployment must replace this endpoint with authenticated signup + robust throttling.
    return this.createGuest.execute();
  }
}
