import { Injectable } from '@nestjs/common';
import { SignJWT } from 'jose';
import type { SessionIssuer } from '../application/session-issuer.port';
import type { GuestIdentity } from '../domain/guest.repository';
@Injectable()
export class JoseSessionIssuer implements SessionIssuer {
  async issue(identity: GuestIdentity): Promise<string> {
    const secret = process.env.DEMO_JWT_SECRET;
    if (!secret || secret.length < 32) throw new Error('DEMO_JWT_SECRET must be >=32 characters');
    return new SignJWT({ name: identity.name })
      .setProtectedHeader({ alg: 'HS256' }).setSubject(identity.id)
      .setIssuer('neon-sakura-api').setAudience('neon-sakura-world')
      .setIssuedAt().setExpirationTime('2h')
      .sign(new TextEncoder().encode(secret));
  }
}
