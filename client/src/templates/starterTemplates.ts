import type { Normal, PieceState, PieceType, Position, WallState } from '../types'

export type StarterTemplateId = 'classic-house' | 'candy-cottage'

interface StarterTemplateWall {
    key: string
    start: [number, number]
    end: [number, number]
    height: number
}

interface StarterTemplatePiece {
    type: PieceType
    pos: Position
    yaw: number
    attachedToWallKey?: string
    attachedTo?: string
    snapNormal?: Normal
}

export interface StarterTemplate {
    id: StarterTemplateId
    name: string
    piecesLabel: string
    walls: StarterTemplateWall[]
    pieces: StarterTemplatePiece[]
}

export interface StarterTemplateActions {
    createWall: (start: [number, number], end: [number, number], height?: number) => Promise<WallState | null>
    spawnPiece: (type: PieceType) => Promise<PieceState | null>
    releasePiece: (pos: Position, yaw: number, attachedTo?: string | null, snapNormal?: Normal | null) => Promise<void>
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
    {
        id: 'classic-house',
        name: 'Classic House',
        piecesLabel: '4 walls, door, windows',
        walls: [
            { key: 'front', start: [-2, -1.5], end: [2, -1.5], height: 1.5 },
            { key: 'right', start: [2, -1.5], end: [2, 1.5], height: 1.5 },
            { key: 'back', start: [2, 1.5], end: [-2, 1.5], height: 1.5 },
            { key: 'left', start: [-2, 1.5], end: [-2, -1.5], height: 1.5 },
        ],
        pieces: [
            { type: 'DOOR', pos: [0, 0.45, -1.62], yaw: 0, attachedToWallKey: 'front', snapNormal: [0, 0, -1] },
            { type: 'WINDOW_SMALL', pos: [-1.1, 0.85, -1.62], yaw: 0, attachedToWallKey: 'front', snapNormal: [0, 0, -1] },
            { type: 'WINDOW_SMALL', pos: [1.1, 0.85, -1.62], yaw: 0, attachedToWallKey: 'front', snapNormal: [0, 0, -1] },
            { type: 'MINI_TREE', pos: [-2.7, 0, -2.1], yaw: 0.35 },
            { type: 'PRESENT', pos: [2.6, 0, -2.05], yaw: -0.25 },
        ],
    },
    {
        id: 'candy-cottage',
        name: 'Candy Cottage',
        piecesLabel: 'cozy shell, candy trim',
        walls: [
            { key: 'front', start: [-1.6, -1.2], end: [1.6, -1.2], height: 1.5 },
            { key: 'right', start: [1.6, -1.2], end: [1.6, 1.2], height: 1.5 },
            { key: 'back', start: [1.6, 1.2], end: [-1.6, 1.2], height: 1.5 },
            { key: 'left', start: [-1.6, 1.2], end: [-1.6, -1.2], height: 1.5 },
        ],
        pieces: [
            { type: 'DOOR', pos: [0, 0.45, -1.32], yaw: 0, attachedToWallKey: 'front', snapNormal: [0, 0, -1] },
            { type: 'GUMDROP', pos: [-0.85, 1.05, -1.32], yaw: 0, attachedToWallKey: 'front', snapNormal: [0, 0, -1] },
            { type: 'GUMDROP', pos: [0.85, 1.05, -1.32], yaw: 0, attachedToWallKey: 'front', snapNormal: [0, 0, -1] },
            { type: 'COOKIE_STAR', pos: [0, 1.18, -1.32], yaw: 0, attachedToWallKey: 'front', snapNormal: [0, 0, -1] },
            { type: 'CANDY_CANE', pos: [-2.15, 0, -1.75], yaw: 0.5 },
            { type: 'FROSTING_DOLLOP', pos: [2.1, 0, -1.7], yaw: -0.2 },
        ],
    },
]

export function getStarterTemplate(templateId: StarterTemplateId): StarterTemplate {
    const template = STARTER_TEMPLATES.find((candidate) => candidate.id === templateId)
    if (!template) {
        throw new Error(`Unknown starter template: ${templateId}`)
    }
    return template
}

export async function applyStarterTemplate(
    templateId: StarterTemplateId,
    actions: StarterTemplateActions
): Promise<void> {
    const template = getStarterTemplate(templateId)
    const createdWallIds = new Map<string, string>()

    for (const wall of template.walls) {
        const createdWall = await actions.createWall(wall.start, wall.end, wall.height)
        if (!createdWall) {
            throw new Error(`Could not create ${template.name}`)
        }
        createdWallIds.set(wall.key, createdWall.wallId)
    }

    for (const piece of template.pieces) {
        const spawnedPiece = await actions.spawnPiece(piece.type)
        if (!spawnedPiece) {
            throw new Error(`Could not place ${template.name}`)
        }

        const attachedTo = piece.attachedToWallKey
            ? createdWallIds.get(piece.attachedToWallKey) || null
            : piece.attachedTo || null
        await actions.releasePiece(piece.pos, piece.yaw, attachedTo, piece.snapNormal || null)
    }
}
