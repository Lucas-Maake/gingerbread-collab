import { describe, expect, it, vi } from 'vitest'
import { applyStarterTemplate, getStarterTemplate, STARTER_TEMPLATES } from './starterTemplates'
import type { PieceState, WallState } from '../types'

function makeWall(index: number, start: [number, number], end: [number, number], height: number): WallState {
    return {
        wallId: `wall-${index}`,
        start,
        end,
        height,
        thickness: 0.15,
        createdBy: 'user-1',
        version: 1,
    }
}

function makePiece(index: number, type: PieceState['type']): PieceState {
    return {
        pieceId: `piece-${index}`,
        type,
        pos: [0, 0, 0],
        yaw: 0,
        heldBy: 'user-1',
        spawnedBy: 'user-1',
        attachedTo: null,
        snapNormal: null,
        version: 1,
    }
}

describe('starterTemplates', () => {
    it('defines useful starter templates', () => {
        expect(STARTER_TEMPLATES.map((template) => template.id)).toEqual([
            'classic-house',
            'candy-cottage',
        ])
        expect(getStarterTemplate('classic-house').walls).toHaveLength(4)
        expect(getStarterTemplate('classic-house').pieces.length).toBeGreaterThan(0)
    })

    it('creates walls and places attached pieces from a template', async () => {
        let wallIndex = 0
        let pieceIndex = 0
        const createWall = vi.fn(async (start: [number, number], end: [number, number], height = 1.5) => {
            wallIndex += 1
            return makeWall(wallIndex, start, end, height)
        })
        const spawnPiece = vi.fn(async (type: PieceState['type']) => {
            pieceIndex += 1
            return makePiece(pieceIndex, type)
        })
        const releasePiece = vi.fn(async () => undefined)

        await applyStarterTemplate('classic-house', {
            createWall,
            spawnPiece,
            releasePiece,
        })

        expect(createWall).toHaveBeenCalledTimes(4)
        expect(spawnPiece).toHaveBeenCalledWith('DOOR')
        expect(releasePiece).toHaveBeenCalledWith(
            [0, 0.45, -1.62],
            0,
            'wall-1',
            [0, 0, -1]
        )
    })
})
