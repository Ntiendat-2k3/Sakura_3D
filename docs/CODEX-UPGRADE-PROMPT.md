# Codex prompt — moving an older project to Architecture v2

Copy the prompt below into the Codex Agent of your existing project:

> Audit the current Neon Sakura City workspace. Compare with this architecture v2 starter without deleting any user work. Keep Sequelize v6, Clean Architecture, Colyseus 0.16 and local free development. Produce a file-by-file migration plan. Do NOT overwrite `.env`, custom models, existing data volumes or scripts. Before changing dependencies, check exact versions and compatibility. Introduce independent domain/application/infrastructure/presentation modules, a pure shared game-protocol package, a dedicated authoritative Colyseus room, and smaller web game components. Use Sequelize migrations only; do not call sync({alter:true}). Run pnpm test/typecheck/build, Docker migrations and browser two-tab smoke tests. Write ARCHITECTURE_MIGRATION_REPORT.md with proof of results, issues and next steps. Ask before irreversible operations.

For a **new** project, use the archive directly and run `scripts/Init-Local.ps1` then the README instructions.
