import type { GuestIdentity } from '../domain/guest.repository';
export const SESSION_ISSUER = Symbol('SESSION_ISSUER');
export interface SessionIssuer { issue(identity: GuestIdentity): Promise<string> }
