import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../../context/gameStore'

// Vertex shader - renders directly to screen space (ignores camera)
const vertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  // Render directly in clip space - completely ignores camera transforms
  // Position.xy goes from -1 to 1, which maps to full screen
  gl_Position = vec4(position.xy, 0.9999, 1.0);
}
`

// Fragment shader with frosted window effect (optimized)
const fragmentShader = `
uniform float uTime;
uniform vec2 uResolution;
uniform float uFrostIntensity;
uniform float uNightMix;

varying vec2 vUv;

// === FAST HASH NOISE (cheaper than simplex) ===
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float hash3(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

// Value noise (much cheaper than simplex)
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f); // smoothstep

  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// === INDIVIDUAL TREE SHAPE (tiered Christmas tree) ===
float treeShape(vec2 uv, vec2 pos, float height, float width) {
  vec2 p = uv - pos;

  // Trunk
  float trunk = step(abs(p.x), width * 0.15) * step(0.0, p.y) * step(p.y, height * 0.12);

  // Bottom tier - widest
  float tier1Y = height * 0.08;
  float tier1H = height * 0.35;
  float tier1 = step(tier1Y, p.y) * step(p.y, tier1Y + tier1H) *
                step(abs(p.x), width * (1.0 - (p.y - tier1Y) / tier1H));

  // Middle tier
  float tier2Y = height * 0.30;
  float tier2H = height * 0.35;
  float tier2 = step(tier2Y, p.y) * step(p.y, tier2Y + tier2H) *
                step(abs(p.x), width * 0.8 * (1.0 - (p.y - tier2Y) / tier2H));

  // Top tier - narrowest
  float tier3Y = height * 0.52;
  float tier3H = height * 0.48;
  float tier3 = step(tier3Y, p.y) * step(p.y, tier3Y + tier3H) *
                step(abs(p.x), width * 0.6 * (1.0 - (p.y - tier3Y) / tier3H));

  return max(max(max(trunk, tier1), tier2), tier3);
}

// === WINTER SCENE ===
vec3 winterScene(vec2 uv) {
  // Day sky gradient
  vec3 daySkyTop = vec3(0.45, 0.58, 0.78);
  vec3 daySkyMid = vec3(0.68, 0.75, 0.85);
  vec3 daySkyBottom = vec3(0.85, 0.82, 0.88);

  // Night sky gradient (deep blue with purple tones)
  vec3 nightSkyTop = vec3(0.05, 0.08, 0.18);
  vec3 nightSkyMid = vec3(0.10, 0.12, 0.25);
  vec3 nightSkyBottom = vec3(0.15, 0.18, 0.32);

  // Interpolate sky colors
  vec3 skyTop = mix(daySkyTop, nightSkyTop, uNightMix);
  vec3 skyMid = mix(daySkyMid, nightSkyMid, uNightMix);
  vec3 skyBottom = mix(daySkyBottom, nightSkyBottom, uNightMix);

  vec3 sky = mix(skyBottom, skyMid, smoothstep(0.0, 0.5, uv.y));
  sky = mix(sky, skyTop, smoothstep(0.5, 1.0, uv.y));

  // Add stars at night (soft circular stars, no hard edges)
  float starField = 0.0;
  vec2 starUv = uv * 60.0;
  vec2 starCell = floor(starUv);
  vec2 starF = fract(starUv) - 0.5;
  float starRand = hash(starCell);
  // Only some cells have stars
  float hasStar = step(0.92, starRand);
  // Random position within cell
  vec2 starPos = vec2(hash(starCell + 0.1), hash(starCell + 0.2)) - 0.5;
  starPos *= 0.6;
  // Soft circular star
  float starDist = length(starF - starPos);
  float star = smoothstep(0.08, 0.0, starDist) * hasStar;
  // Twinkle
  float twinkle = 0.6 + 0.4 * sin(uTime * 2.0 + starRand * 50.0);
  // Only show in upper part of sky, fade with night mix
  float starMask = smoothstep(0.35, 0.5, uv.y) * uNightMix;
  sky += vec3(star * twinkle * starMask * 0.8);

  // Distant mountains (darker at night)
  float mountainLine = 0.38 + noise(vec2(uv.x * 1.5, 0.0)) * 0.08;
  float mountainLine2 = 0.32 + noise(vec2(uv.x * 2.5 + 5.0, 0.5)) * 0.06;
  vec3 dayMountain = vec3(0.68, 0.72, 0.82);
  vec3 nightMountain = vec3(0.15, 0.18, 0.28);
  vec3 mountainColor = mix(dayMountain, nightMountain, uNightMix);
  vec3 mountainColor2 = mix(vec3(0.75, 0.78, 0.86), vec3(0.18, 0.20, 0.30), uNightMix);

  // Rolling hills
  float hillLine = 0.30 + noise(vec2(uv.x * 3.0, 1.0)) * 0.05;
  vec3 hillColor = mix(vec3(0.82, 0.84, 0.88), vec3(0.20, 0.22, 0.32), uNightMix);

  // Forest tree line base
  float forestBase = 0.26 + noise(vec2(uv.x * 6.0, 2.0)) * 0.03;
  vec3 forestColor = mix(vec3(0.22, 0.30, 0.26), vec3(0.08, 0.12, 0.10), uNightMix);

  // Snow ground with texture (slightly blue-tinted at night)
  float groundNoise = noise(vec2(uv.x * 20.0, uv.y * 5.0)) * 0.02;
  vec3 daySnow = vec3(0.94 + groundNoise, 0.96 + groundNoise, 0.98);
  vec3 nightSnow = vec3(0.35 + groundNoise, 0.38 + groundNoise, 0.50);
  vec3 snowColor = mix(daySnow, nightSnow, uNightMix);
  vec3 snowShadow = mix(vec3(0.88, 0.91, 0.95), vec3(0.25, 0.28, 0.40), uNightMix);

  // Compose scene from back to front
  vec3 scene = sky;

  // Far mountains
  scene = mix(scene, mountainColor, smoothstep(mountainLine + 0.015, mountainLine - 0.005, uv.y));
  scene = mix(scene, mountainColor2, smoothstep(mountainLine2 + 0.01, mountainLine2 - 0.005, uv.y));

  // Hills
  scene = mix(scene, hillColor, smoothstep(hillLine + 0.015, hillLine - 0.005, uv.y));

  // Forest base
  scene = mix(scene, forestColor, smoothstep(forestBase + 0.01, forestBase - 0.003, uv.y) * 0.8);

  // Individual trees (scattered along the tree line) - taller and more prominent
  float trees = 0.0;
  for (float i = 0.0; i < 15.0; i++) {
    float xPos = hash(vec2(i * 7.3, 0.0));
    float treeHeight = 0.06 + hash(vec2(i * 3.1, 1.0)) * 0.05;
    float treeWidth = 0.018 + hash(vec2(i * 5.7, 2.0)) * 0.012;
    float yBase = forestBase + noise(vec2(xPos * 6.0, 2.0)) * 0.03 - 0.01;
    trees = max(trees, treeShape(uv, vec2(xPos, yBase), treeHeight, treeWidth));
  }
  scene = mix(scene, forestColor * 0.85, trees);

  // Snow ground - moved up
  float groundBlend = smoothstep(0.24, 0.18, uv.y);
  scene = mix(scene, snowColor, groundBlend);

  // Snow shadows/drifts - moved up
  float driftNoise = noise(vec2(uv.x * 15.0, 0.0));
  float drift = smoothstep(0.20, 0.16, uv.y) * driftNoise * 0.3;
  scene = mix(scene, snowShadow, drift);

  return scene;
}

// === FALLING SNOW (soft circular particles) ===
float snowParticles(vec2 uv, float time) {
  float snow = 0.0;

  // Layer 1 - larger, slower flakes
  vec2 p1 = uv * 12.0;
  p1.y += time * 0.8;
  vec2 cell1 = floor(p1);
  vec2 f1 = fract(p1);
  float r1 = hash(cell1);
  // Random position within cell (centered)
  vec2 center1 = vec2(0.3 + r1 * 0.4, 0.3 + fract(r1 * 7.0) * 0.4);
  center1.x += sin(time * 0.4 + r1 * 6.28) * 0.1;
  float dist1 = length(f1 - center1);
  snow += smoothstep(0.06, 0.02, dist1) * 0.5;

  // Layer 2 - smaller, faster flakes
  vec2 p2 = uv * 20.0;
  p2.y += time * 1.5;
  vec2 cell2 = floor(p2);
  vec2 f2 = fract(p2);
  float r2 = hash(cell2 + 50.0);
  vec2 center2 = vec2(0.3 + r2 * 0.4, 0.3 + fract(r2 * 11.0) * 0.4);
  center2.x += sin(time * 0.5 + r2 * 6.28) * 0.08;
  float dist2 = length(f2 - center2);
  snow += smoothstep(0.04, 0.01, dist2) * 0.35;

  return snow;
}

// === MAIN ===
void main() {
  vec2 uv = vUv;

  // Very subtle distortion for slight frosted glass feel
  float distort = noise(uv * 6.0 + uTime * 0.015) * 0.004 * uFrostIntensity;
  vec2 distortedUv = uv + vec2(distort);

  // Get winter scene - crisp and clear
  vec3 scene = winterScene(distortedUv);

  // Add falling snow (reduced at night to avoid artifacts)
  float snow = snowParticles(uv, uTime);
  float snowOpacity = mix(0.5, 0.2, uNightMix);
  scene += vec3(snow) * snowOpacity;

  // Pronounced frost vignette - stronger at edges
  float vignette = length(uv - 0.5);
  float frostEdge = smoothstep(0.25, 0.6, vignette) * uFrostIntensity * 0.25;
  vec3 dayFrost = vec3(0.90, 0.93, 0.97);
  vec3 nightFrost = vec3(0.20, 0.22, 0.35);
  scene = mix(scene, mix(dayFrost, nightFrost, uNightMix), frostEdge);

  // Stronger corner frost
  vec2 cornerDist = min(uv, 1.0 - uv);
  float cornerFrost = smoothstep(0.15, 0.0, min(cornerDist.x, cornerDist.y));
  vec3 dayCornerFrost = vec3(0.92, 0.95, 1.0);
  vec3 nightCornerFrost = vec3(0.18, 0.20, 0.32);
  scene = mix(scene, mix(dayCornerFrost, nightCornerFrost, uNightMix), cornerFrost * 0.4 * uFrostIntensity);

  // Edge frost along borders
  float edgeFrost = smoothstep(0.08, 0.0, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
  vec3 dayEdgeFrost = vec3(0.94, 0.96, 1.0);
  vec3 nightEdgeFrost = vec3(0.15, 0.18, 0.30);
  scene = mix(scene, mix(dayEdgeFrost, nightEdgeFrost, uNightMix), edgeFrost * 0.35 * uFrostIntensity);

  gl_FragColor = vec4(scene, 1.0);
}
`

/**
 * Frosted window background component
 * Renders a fullscreen quad in screen space (completely static, ignores camera)
 * Shows a snowy winter landscape with animated snow
 */
export default function FrostedBackground() {
    const materialRef = useRef<THREE.ShaderMaterial>(null)
    const { size } = useThree()
    const timeOfDay = useGameStore((state) => state.timeOfDay)

    // Create shader material
    const shaderMaterial = useMemo(() => {
        return new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uResolution: { value: new THREE.Vector2(size.width, size.height) },
                uFrostIntensity: { value: 0.8 },
                uNightMix: { value: 0 }
            },
            vertexShader,
            fragmentShader,
            depthWrite: false,
            depthTest: false,
            side: THREE.FrontSide
        })
    }, [])

    // Update night mix when timeOfDay changes
    useEffect(() => {
        if (materialRef.current) {
            materialRef.current.uniforms.uNightMix.value = timeOfDay === 'night' ? 1.0 : 0.0
        }
    }, [timeOfDay])

    // Only animate time - background is static in screen space
    useFrame((state, delta) => {
        if (materialRef.current) {
            materialRef.current.uniforms.uTime.value += delta * 0.5
            materialRef.current.uniforms.uResolution.value.set(size.width, size.height)
        }
    })

    return (
        <mesh renderOrder={-1000} frustumCulled={false}>
            {/* 2x2 plane in clip space (-1 to 1) fills the entire screen */}
            <planeGeometry args={[2, 2]} />
            <primitive object={shaderMaterial} ref={materialRef} attach="material" />
        </mesh>
    )
}
