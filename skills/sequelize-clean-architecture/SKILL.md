---
name: sequelize-clean-architecture
description: Use for NestJS backend features, Sequelize models and migrations, Clean Architecture boundaries, repository adapters, unit tests and transactional application use cases in Neon Sakura City. Do not use Prisma.
---
# Sequelize + Clean Architecture

## Required approach
- Treat the NestJS API as a Modular Monolith and the Colyseus world server as a separately deployable process.
- Each module has `domain/`, `application/`, `infrastructure/` and `presentation/` directories.
- Domain entities and value objects are plain TypeScript and import no frameworks.
- Domain/application define repository interfaces; `Sequelize*Repository` adapters implement them in infrastructure.
- NestJS module providers bind tokens to implementations; presentation controllers call application use cases.
- Use `sequelize` v6, `sequelize-typescript`, PostgreSQL and versioned migrations with sequelize-cli or Umzug. Never generate Prisma files.
- Avoid `sequelize.sync({ force: true })` and `sync({ alter: true })` in production or shared environments.

## Feature checklist
1. Identify domain invariant and use case.
2. Define domain models and repository port plus tests first.
3. Create infrastructure model and explicit mapper (domain <> persistence).
4. Create migration with foreign keys, unique constraints, timestamps and indexes.
5. Implement repository adapter and unit of work/transaction context when needed.
6. Expose API DTO validation (`class-validator`) and auth/permission checks in NestJS.
7. Write unit tests and migration/integration tests (PostgreSQL test database).
8. Update API contract/schema and developer documentation.

## Example module
```
modules/zones/
  domain/entities/zone.entity.ts
  domain/repositories/zone.repository.ts
  application/use-cases/list-zones.use-case.ts
  infrastructure/models/zone.model.ts
  infrastructure/repositories/sequelize-zone.repository.ts
  infrastructure/mappers/zone.mapper.ts
  presentation/controllers/zones.controller.ts
  zones.module.ts
```

## Transactions and scaling
- Expose transaction operations through an application-level interface rather than importing Sequelize into use cases.
- Use database constraints to enforce invariants; catch unique violations and map to domain errors.
- Use cursor pagination for large chat/message/history datasets.
- Do not write real-time player movement to the database every simulation tick.
- Add caching only after measuring, and invalidate/cache-by-version explicitly.

## Done criteria
No Prisma imports. Domain dependency direction verified. Migration and tests present. Query access uses parameters and indexes. No credentials in repo.
