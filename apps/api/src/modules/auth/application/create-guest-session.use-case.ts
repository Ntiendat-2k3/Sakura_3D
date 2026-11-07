import type { GuestRepository } from '../domain/guest.repository';
import type { SessionIssuer } from './session-issuer.port';

/** App layer knows neither Sequelize nor JWT implementation. */
export class CreateGuestSessionUseCase {
  constructor(private readonly guests: GuestRepository, private readonly issuer: SessionIssuer) {}
  async execute(): Promise<{ id: string; name: string; token: string }> {
    const guest = await this.guests.createGuest();
    return { ...guest, token: await this.issuer.issue(guest) };
  }
}
