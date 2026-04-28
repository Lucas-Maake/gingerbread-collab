export const SOCKET_EVENTS: Readonly<Record<string, string>>
export const SERVER_EVENTS: Readonly<Record<string, string>>
export const PIECE_TYPES: readonly string[]

export function validateJoinRoomPayload(payload: unknown): { value?: any; error?: string }
export function validateSpawnPiecePayload(payload: unknown): { value?: any; error?: string }
export function validatePieceIdPayload(payload: unknown, error?: string): { value?: any; error?: string }
export function validateWallIdPayload(payload: unknown): { value?: any; error?: string }
export function validateIcingIdPayload(payload: unknown): { value?: any; error?: string }
export function validateCursorUpdatePayload(payload: unknown): { value?: any; error?: string }
export function validateTransformUpdatePayload(payload: unknown): { value?: any; error?: string }
export function validateReleasePiecePayload(payload: unknown): { value?: any; error?: string }
export function validateCreateWallSegmentPayload(payload: unknown): { value?: any; error?: string }
export function validateCreateFenceLinePayload(payload: unknown): { value?: any; error?: string }
export function validateCreateIcingStrokePayload(payload: unknown): { value?: any; error?: string }
export function validateSendChatMessagePayload(payload: unknown): { value?: any; error?: string }
