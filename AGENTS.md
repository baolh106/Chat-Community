# Repository Guidelines

## Project Structure & Module Organization

This is a TypeScript Node.js service using Express, Socket.IO, Redis,
SurrealDB, and Telegram integrations. Source code lives in `src/`; entry
points are `src/index.ts` and `src/bootstrap.ts`.

- `src/modules/` contains feature modules such as `auth` and `message`,
  organized by `api`, `application`, `domain`, `infrastructure`, and
  `presentation`.
- `src/infrastructure/` contains shared adapters for Redis, Socket.IO,
  Telegram, event bus, and unit-of-work/database concerns.
- `src/shared/`, `src/common/`, and `src/config/` hold helpers, constants,
  middleware, server setup, and environment/database configuration.
- Tests live under `src`, either beside code as `*.test.ts` / `*.spec.ts` or in
  `__tests__` directories. Postman assets are in `postman/`. Build output goes
  to `dist/`.

## Build, Test, and Development Commands

- `npm run dev` starts the service with `nodemon`, `tsx`, and dotenv support.
- `npm run build` bundles `src/index.ts` to `dist/` with esbuild.
- `npm start` runs the built app from `dist/index.js`.
- `npm run type-check` runs TypeScript without emitting files.
- `npm test` runs Jest once; `npm run test:watch` runs Jest in watch mode.
- `npm run lint-fix` applies ESLint fixes and Prettier formatting to `src`.
- `docker compose up -d redis` starts the local Redis dependency.

## Coding Style & Naming Conventions

Use TypeScript ESM imports. Prettier enforces 2 spaces, semicolons, double
quotes, trailing commas, and 80-column print width. ESLint requires consistent
type imports, so prefer `import type`. Keep filenames aligned with existing
patterns such as `*.application.ts`, `*.interface.ts`, `*.middleware.ts`, and
`*.notifier.ts`.

## Testing Guidelines

Jest uses `ts-jest` with the Node environment and searches under `src`. Name
tests `*.test.ts` or `*.spec.ts`. For adapters, follow the existing `__tests__`
pattern near the infrastructure being tested. Add focused unit tests for
application services, event handlers, middleware, and adapter behavior. Run
`npm test` and `npm run type-check` before submitting.

## Commit & Pull Request Guidelines

Recent history uses short Conventional Commit style messages such as
`feat: telegram bot send poll` and `refactor: env`. Keep commits scoped and use
prefixes like `feat:`, `fix:`, `refactor:`, `test:`, or `chore:`.

Pull requests should include a concise summary, linked issue or task when
available, test results, and notes for configuration or migration changes. Add
screenshots or Socket.IO/Postman examples when API or realtime behavior changes.

## Security & Configuration Tips

Copy `.env.example` for local setup and never commit real secrets. Telegram
tokens, socket secrets, JWT keys, Redis URLs, and SurrealDB credentials must
stay environment-specific.
