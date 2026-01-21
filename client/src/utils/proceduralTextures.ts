import * as THREE from 'three'

/**
 * Create a procedural gingerbread cookie texture
 */
export function createGingerbreadTexture(
    width = 256,
    height = 256,
    baseColor = '#CD853F'
): THREE.CanvasTexture {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!

    const base = new THREE.Color(baseColor)
    const r = Math.floor(base.r * 255)
    const g = Math.floor(base.g * 255)
    const b = Math.floor(base.b * 255)

    ctx.fillStyle = baseColor
    ctx.fillRect(0, 0, width, height)

    const spotCount = 30 + Math.floor(Math.random() * 20)
    for (let i = 0; i < spotCount; i++) {
        const x = Math.random() * width
        const y = Math.random() * height
        const radius = 3 + Math.random() * 8
        const darken = 0.85 + Math.random() * 0.1

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
        gradient.addColorStop(0, `rgba(${Math.floor(r * darken)}, ${Math.floor(g * darken)}, ${Math.floor(b * darken)}, 0.4)`)
        gradient.addColorStop(1, 'rgba(0,0,0,0)')

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.fill()
    }

    const lightSpotCount = 15 + Math.floor(Math.random() * 10)
    for (let i = 0; i < lightSpotCount; i++) {
        const x = Math.random() * width
        const y = Math.random() * height
        const radius = 2 + Math.random() * 5
        const lighten = 1.1 + Math.random() * 0.1

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
        gradient.addColorStop(0, `rgba(${Math.min(255, Math.floor(r * lighten))}, ${Math.min(255, Math.floor(g * lighten))}, ${Math.min(255, Math.floor(b * lighten))}, 0.3)`)
        gradient.addColorStop(1, 'rgba(0,0,0,0)')

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.fill()
    }

    const imageData = ctx.getImageData(0, 0, width, height)
    const data = imageData.data
    for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 15
        data[i] = Math.max(0, Math.min(255, data[i] + noise))
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise))
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise))
    }
    ctx.putImageData(imageData, 0, 0)

    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping

    return texture
}

/**
 * Create a procedural peppermint swirl texture
 */
export function createPeppermintTexture(
    width = 256,
    height = 256,
    color1 = '#DC143C',
    color2 = '#FFFFFF'
): THREE.CanvasTexture {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!

    const centerX = width / 2
    const centerY = height / 2
    const maxRadius = Math.max(width, height) / 2

    const segments = 8
    const angleStep = (Math.PI * 2) / segments

    for (let i = 0; i < segments; i++) {
        const startAngle = i * angleStep
        const endAngle = (i + 1) * angleStep

        ctx.beginPath()
        ctx.moveTo(centerX, centerY)
        ctx.arc(centerX, centerY, maxRadius * 1.5, startAngle, endAngle)
        ctx.closePath()
        ctx.fillStyle = i % 2 === 0 ? color1 : color2
        ctx.fill()
    }

    const highlight = ctx.createRadialGradient(
        centerX - width * 0.2, centerY - height * 0.2, 0,
        centerX, centerY, maxRadius
    )
    highlight.addColorStop(0, 'rgba(255, 255, 255, 0.3)')
    highlight.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)')
    highlight.addColorStop(1, 'rgba(0, 0, 0, 0)')

    ctx.fillStyle = highlight
    ctx.fillRect(0, 0, width, height)

    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.ClampToEdgeWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping

    return texture
}

/**
 * Create a candy cane stripe texture
 */
export function createCandyCaneTexture(
    width = 128,
    height = 256,
    color1 = '#DC143C',
    color2 = '#FFFFFF'
): THREE.CanvasTexture {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!

    ctx.fillStyle = color2
    ctx.fillRect(0, 0, width, height)

    const stripeWidth = width / 3
    ctx.fillStyle = color1

    for (let i = -height; i < width + height; i += stripeWidth * 2) {
        ctx.beginPath()
        ctx.moveTo(i, 0)
        ctx.lineTo(i + stripeWidth, 0)
        ctx.lineTo(i + stripeWidth + height, height)
        ctx.lineTo(i + height, height)
        ctx.closePath()
        ctx.fill()
    }

    const glossGradient = ctx.createLinearGradient(0, 0, width, 0)
    glossGradient.addColorStop(0, 'rgba(255, 255, 255, 0.2)')
    glossGradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.4)')
    glossGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)')
    glossGradient.addColorStop(1, 'rgba(0, 0, 0, 0.1)')

    ctx.fillStyle = glossGradient
    ctx.fillRect(0, 0, width, height)

    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping

    return texture
}

/**
 * Create a frosting texture
 */
export function createFrostingTexture(
    width = 128,
    height = 128,
    baseColor = '#FFFAF0'
): THREE.CanvasTexture {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!

    const base = new THREE.Color(baseColor)
    const r = Math.floor(base.r * 255)
    const g = Math.floor(base.g * 255)
    const b = Math.floor(base.b * 255)

    ctx.fillStyle = baseColor
    ctx.fillRect(0, 0, width, height)

    const swirlCount = 8 + Math.floor(Math.random() * 5)
    for (let i = 0; i < swirlCount; i++) {
        const x = Math.random() * width
        const y = Math.random() * height
        const radius = 10 + Math.random() * 20

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
        const lighten = 1.02 + Math.random() * 0.03
        gradient.addColorStop(0, `rgba(${Math.min(255, Math.floor(r * lighten))}, ${Math.min(255, Math.floor(g * lighten))}, ${Math.min(255, Math.floor(b * lighten))}, 0.5)`)
        gradient.addColorStop(1, 'rgba(0,0,0,0)')

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.fill()
    }

    const imageData = ctx.getImageData(0, 0, width, height)
    const data = imageData.data
    for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 5
        data[i] = Math.max(0, Math.min(255, data[i] + noise))
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise))
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise))
    }
    ctx.putImageData(imageData, 0, 0)

    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping

    return texture
}

/**
 * Create a star cookie texture with golden sparkle
 */
export function createStarCookieTexture(
    width = 256,
    height = 256,
    baseColor = '#FFD54F'
): THREE.CanvasTexture {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!

    const base = new THREE.Color(baseColor)
    const r = Math.floor(base.r * 255)
    const g = Math.floor(base.g * 255)
    const b = Math.floor(base.b * 255)

    ctx.fillStyle = baseColor
    ctx.fillRect(0, 0, width, height)

    const sparkleCount = 50 + Math.floor(Math.random() * 30)
    for (let i = 0; i < sparkleCount; i++) {
        const x = Math.random() * width
        const y = Math.random() * height
        const size = 1 + Math.random() * 2

        ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + Math.random() * 0.5})`
        ctx.fillRect(x, y, size, size)
    }

    const spotCount = 20
    for (let i = 0; i < spotCount; i++) {
        const x = Math.random() * width
        const y = Math.random() * height
        const radius = 5 + Math.random() * 15
        const darken = 0.9 + Math.random() * 0.05

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
        gradient.addColorStop(0, `rgba(${Math.floor(r * darken)}, ${Math.floor(g * darken)}, ${Math.floor(b * darken * 0.8)}, 0.3)`)
        gradient.addColorStop(1, 'rgba(0,0,0,0)')

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.fill()
    }

    const imageData = ctx.getImageData(0, 0, width, height)
    const data = imageData.data
    for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 12
        data[i] = Math.max(0, Math.min(255, data[i] + noise))
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise))
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise))
    }
    ctx.putImageData(imageData, 0, 0)

    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping

    return texture
}

// Cache textures to avoid recreation
const textureCache = new Map<string, THREE.CanvasTexture>()

type TextureCreator = (...args: unknown[]) => THREE.CanvasTexture

export function getCachedTexture(
    type: string,
    creator: TextureCreator,
    ...args: unknown[]
): THREE.CanvasTexture {
    const key = `${type}-${args.join('-')}`
    if (!textureCache.has(key)) {
        textureCache.set(key, creator(...args))
    }
    return textureCache.get(key)!
}
