# Repository Guidelines

## Project Structure & Module Organization
- `client/`: Vite + React (TypeScript) frontend.
  - `client/src/components/3d`: Three.js/R3F scene and interaction components.
  - `client/src/components/ui`: UI panels, controls, and HUD.
  - `client/src/context`: Zustand store and socket event wiring.
  - `client/src/utils`: snapping, sockets, geometry, and helpers.
  - `client/public`: static assets (models, music).
- `server/`: Node.js + Express + Socket.io backend.
  - `server/src/index.js`: server entry.
  - `server/src/handlers`: socket event handlers.
  - `server/src/rooms`: room/user/piece state.
  - `server/src/constants`: configuration.
- `docs/`: PRD and related materials.

## Build, Test, and Development Commands
Run from repo root:
- `npm run install:all`: install client and server dependencies.
- `npm run dev:server`: start backend (defaults to localhost:3001).
- `npm run dev:client`: start frontend (Vite, usually localhost:5173).
- `npm run build:client`: build the client bundle.
- `npm run build`: install both apps and build client.
- `npm run start`: start the production server.

Client-only:
- `cd client && npm run lint`: ESLint on TS/JS sources.

Server-only:
- `cd server && npm test`: Node built-in test runner (`node --test`).

## Coding Style & Naming Conventions
- Client: TypeScript/TSX, 4-space indentation, semicolon-free style.
- Server: JavaScript (ES modules), 2-space indentation.
- React components: `PascalCase` files and component names.
- Hooks: `useThing` naming.
- Constants: `UPPER_SNAKE_CASE` (e.g., `BUILD_SURFACE`).
- Utilities/modules: `camelCase` file/function names.

## Testing Guidelines
- No automated tests are currently committed.
- Server tests can be added under `server/src/**/*.test.js` so `node --test` can discover them.
- If you add client tests, introduce a runner and document the command here.

## Commit & Pull Request Guidelines
- Commit messages in history are short, imperative sentences (no conventional prefixes).
  - Example: "Add decorative piece snapping to walls and roofs".
- PRs should include:
  - What changed and why (brief summary).
  - Testing notes (commands run and results).
  - UI changes: screenshots or short clips.

## Configuration Notes
- Environment examples: `client/.env.example`, `server/.env.example`.
- Client can override the backend via `VITE_SERVER_URL`.
- Node.js 18+ is required (see `package.json`).
