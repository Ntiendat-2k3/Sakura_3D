import { jwtVerify } from 'jose';
export interface PlayerIdentity { id: string; name: string }
export async function verifyDemoToken(token: unknown): Promise<PlayerIdentity> {
  if (typeof token !== 'string' || token.length > 4096) throw new Error('Missing token');
  const secret = process.env.DEMO_JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('DEMO_JWT_SECRET must be >=32 characters');
  const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
    issuer: 'neon-sakura-api', audience: 'neon-sakura-world', algorithms: ['HS256'],
  });
  if (typeof payload.sub !== 'string' || typeof payload.name !== 'string') throw new Error('Invalid player claims');
  if (payload.sub.length > 80 || payload.name.length > 32) throw new Error('Invalid player claims');
  return { id: payload.sub, name: payload.name };
}
