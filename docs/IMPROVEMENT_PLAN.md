# Gingerbread Collab Improvement Plan

Date: February 7, 2026
Owner: Engineering

## Phase 0 - Quick Wins (This pass)

1. Harden payload validation for wall and icing events on server boundaries and room domain logic.
2. Improve room link copy UX with explicit success/error feedback and clipboard fallback.
3. Re-baseline roadmap checklist to reflect implemented features.

Success criteria:
- Invalid geometry payloads are rejected consistently.
- Copy link action provides immediate user feedback.
- `TODO.md` reflects current shipped features.

## Phase 1 - Reliability and Abuse Protection

1. Add per-socket limits for high-impact events: `spawn_piece`, `delete_piece`, `create_wall_segment`, `create_fence_line`, `create_icing_stroke`, `send_chat_message`, `join_room`.
2. Add structured logging with correlation IDs for socket lifecycle and room mutations.
3. Add server integration tests for reconnect, undo, conflict locks, and invalid payload rejection.

Success criteria:
- Event spam does not degrade room responsiveness.
- Production logs support room-level incident debugging.
- CI catches regressions in core multiplayer flow.

## Phase 2 - Persistence and Horizontal Scale

1. Persist room snapshots and user/session metadata to Redis or database.
2. Add Socket.IO Redis adapter for multi-instance pub/sub.
3. Restore room state on process restart and enforce TTL cleanup.

Success criteria:
- Rooms survive restarts.
- Multiple server instances share room state correctly.
- Expired rooms are reclaimed automatically.

## Phase 3 - Rendering and UX Performance

1. Remove always-on `preserveDrawingBuffer`; enable screenshot capture path without global render penalty.
2. Cache raycast target sets to avoid repeated scene traversal on pointer movement.
3. Add performance telemetry (frame time, piece count, event throughput) and optimization thresholds.

Success criteria:
- Improved FPS under high piece counts.
- Lower CPU/GPU overhead during dragging and snapping.
- Performance regressions are measurable and detectable.

## Phase 4 - Accessibility and Mobile Support

1. Add responsive room layout breakpoints for controls and overlays.
2. Add touch gestures for camera control and piece interactions.
3. Improve keyboard and screen reader support for room UI controls.

Success criteria:
- Core room flow is usable on mobile/touch devices.
- Keyboard-only path is available for essential actions.
- Interactive controls include accessible labels and focus states.
