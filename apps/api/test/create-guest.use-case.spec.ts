import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CreateGuestSessionUseCase } from '../src/modules/auth/application/create-guest-session.use-case';
test('guest onboarding depends on ports, not ORM or JWT', async () => {
  const useCase = new CreateGuestSessionUseCase(
    { createGuest: async () => ({ id: 'u1', name: 'Guest-123' }) },
    { issue: async identity => `jwt-for-${identity.id}` },
  );
  assert.deepEqual(await useCase.execute(), { id: 'u1', name: 'Guest-123', token: 'jwt-for-u1' });
});
