export const GUEST_REPOSITORY = Symbol('GUEST_REPOSITORY');
export type GuestIdentity = Readonly<{ id: string; name: string }>;
export interface GuestRepository { createGuest(): Promise<GuestIdentity> }
