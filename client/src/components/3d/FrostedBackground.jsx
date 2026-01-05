import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

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

// === INDIVIDUAL TREE SHAPE ===
float treeShape(vec2 uv, vec2 pos, float height, float width) {
  vec2 p = uv - pos;
  // Triangle tree shape
  float trunk = step(abs(p.x), 0.003) * step(0.0, p.y) * step(p.y, height * 0.15);
  float crown = step(p.y, height) * step(abs(p.x), width * (1.0 - p.y / height));
  return max(trunk, crown);
}

// === WINTER SCENE ===
vec3 winterScene(vec2 uv) {
  // Sky gradient - richer colors
  vec3 skyTop = vec3(0.45, 0.58, 0.78);
  vec3 skyMid = vec3(0.68, 0.75, 0.85);
  vec3 skyBottom = vec3(0.85, 0.82, 0.88);
  vec3 sky = mix(skyBottom, skyMid, smoothstep(0.0, 0.5, uv.y));
  sky = mix(sky, skyTop, smoothstep(0.5, 1.0, uv.y));

  // Distant mountains
  float mountainLine = 0.38 + noise(vec2(uv.x * 1.5, 0.0)) * 0.08;
  float mountainLine2 = 0.32 + noise(vec2(uv.x * 2.5 + 5.0, 0.5)) * 0.06;
  vec3 mountainColor = vec3(0.68, 0.72, 0.82);
  vec3 mountainColor2 = vec3(0.75, 0.78, 0.86);

  // Rolling hills
  float hillLine = 0.24 + noise(vec2(uv.x * 3.0, 1.0)) * 0.05;
  vec3 hillColor = vec3(0.82, 0.84, 0.88);

  // Forest tree line base
  float forestBase = 0.18 + noise(vec2(uv.x * 6.0, 2.0)) * 0.03;
  vec3 forestColor = vec3(0.22, 0.30, 0.26);

  // Snow ground with texture
  float groundNoise = noise(vec2(uv.x * 20.0, uv.y * 5.0)) * 0.02;
  vec3 snowColor = vec3(0.94 + groundNoise, 0.96 + groundNoise, 0.98);
  vec3 snowShadow = vec3(0.88, 0.91, 0.95);

  // Compose scene from back to front
  vec3 scene = sky;

  // Far mountains
  scene = mix(scene, mountainColor, smoothstep(mountainLine + 0.015, mountainLine - 0.005, uv.y));
  scene = mix(scene, mountainColor2, smoothstep(mountainLine2 + 0.01, mountainLine2 - 0.005, uv.y));

  // Hills
  scene = mix(scene, hillColor, smoothstep(hillLine + 0.015, hillLine - 0.005, uv.y));

  // Forest base
  scene = mix(scene, forestColor, smoothstep(forestBase + 0.01, forestBase - 0.003, uv.y) * 0.8);

  // Individual trees (scattered along the tree line)
  float trees = 0.0;
  for (float i = 0.0; i < 12.0; i++) {
    float xPos = hash(vec2(i * 7.3, 0.0));
    float treeHeight = 0.04 + hash(vec2(i * 3.1, 1.0)) * 0.035;
    float treeWidth = 0.012 + hash(vec2(i * 5.7, 2.0)) * 0.008;
    float yBase = forestBase + noise(vec2(xPos * 6.0, 2.0)) * 0.03 - 0.01;
    trees = max(trees, treeShape(uv, vec2(xPos, yBase), treeHeight, treeWidth));
  }
  scene = mix(scene, forestColor * 0.85, trees);

  // Snow ground
  float groundBlend = smoothstep(0.16, 0.10, uv.y);
  scene = mix(scene, snowColor, groundBlend);

  // Snow shadows/drifts
  float driftNoise = noise(vec2(uv.x * 15.0, 0.0));
  float drift = smoothstep(0.12, 0.08, uv.y) * driftNoise * 0.3;
  scene = mix(scene, snowShadow, drift);

  return scene;
}

// === FALLING SNOW (optimized - 2 layers) ===
float snowParticles(vec2 uv, float time) {
  float snow = 0.0;

  // Layer 1 - larger, slower
  vec2 p1 = uv * 15.0;
  p1.y += time * 1.0;
  vec2 cell1 = floor(p1);
  vec2 f1 = fract(p1) - 0.5;
  float r1 = hash(cell1);
  vec2 pos1 = vec2(r1 - 0.5, fract(r1 * 13.7) - 0.5) * 0.7;
  pos1.x += sin(time * 0.5 + r1 * 6.28) * 0.15;
  snow += smoothstep(0.025, 0.0, length(f1 - pos1)) * 0.6;

  // Layer 2 - smaller, faster
  vec2 p2 = uv * 25.0;
  p2.y += time * 1.8;
  vec2 cell2 = floor(p2);
  vec2 f2 = fract(p2) - 0.5;
  float r2 = hash(cell2 + 100.0);
  vec2 pos2 = vec2(r2 - 0.5, fract(r2 * 17.3) - 0.5) * 0.7;
  pos2.x += sin(time * 0.6 + r2 * 6.28) * 0.12;
  snow += smoothstep(0.018, 0.0, length(f2 - pos2)) * 0.4;

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

  // Add falling snow
  float snow = snowParticles(uv, uTime);
  scene += vec3(snow) * 0.5;

  // Pronounced frost vignette - stronger at edges
  float vignette = length(uv - 0.5);
  float frostEdge = smoothstep(0.25, 0.6, vignette) * uFrostIntensity * 0.25;
  scene = mix(scene, vec3(0.90, 0.93, 0.97), frostEdge);

  // Stronger corner frost
  vec2 cornerDist = min(uv, 1.0 - uv);
  float cornerFrost = smoothstep(0.15, 0.0, min(cornerDist.x, cornerDist.y));
  scene = mix(scene, vec3(0.92, 0.95, 1.0), cornerFrost * 0.4 * uFrostIntensity);

  // Edge frost along borders
  float edgeFrost = smoothstep(0.08, 0.0, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
  scene = mix(scene, vec3(0.94, 0.96, 1.0), edgeFrost * 0.35 * uFrostIntensity);

  gl_FragColor = vec4(scene, 1.0);
}
`

/**
 * Frosted window background component
 * Renders a fullscreen quad in screen space (completely static, ignores camera)
 * Shows a snowy winter landscape with animated snow
 */
export default function FrostedBackground() {
  const materialRef = useRef()
  const { size } = useThree()

  // Create shader material
  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(size.width, size.height) },
        uFrostIntensity: { value: 0.8 }
      },
      vertexShader,
      fragmentShader,
      depthWrite: false,
      depthTest: false,
      side: THREE.FrontSide
    })
  }, [])

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
