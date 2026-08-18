import { memo, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const RADIUS = 2.1;
const COUNT = 200;
const LINK_DIST = 0.78;
const HUBS = 11;
const GOLD = "#d4af37";

/** Soft radial glow sprite used for every particle. */
function makeDotTexture() {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,240,200,1)");
  g.addColorStop(0.35, "rgba(212,175,55,0.75)");
  g.addColorStop(1, "rgba(212,175,55,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

/** Fibonacci sphere distribution. */
function fibonacciSphere(count: number, radius: number) {
  const pts: THREE.Vector3[] = [];
  const phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = phi * i;
    pts.push(new THREE.Vector3(Math.cos(theta) * r * radius, y * radius, Math.sin(theta) * r * radius));
  }
  return pts;
}

function ringGeometry(rx: number, ry = 0, radius = RADIUS * 1.16) {
  const pts: THREE.Vector3[] = [];
  const seg = 90;
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  geo.rotateX(rx);
  geo.rotateZ(ry);
  return geo;
}

function Globe({ reduced }: { reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  const hubGroup = useRef<THREE.Group>(null);
  const { size } = useThree();
  const pointer = useRef({ x: 0, y: 0 });

  const tex = useMemo(() => makeDotTexture(), []);
  const points = useMemo(() => fibonacciSphere(COUNT, RADIUS), []);

  const { positions, sizes, hubPositions, hubSizes } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const sizes = new Float32Array(COUNT);
    points.forEach((p, i) => {
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
      sizes[i] = 0.055;
    });
    const step = Math.floor(COUNT / HUBS);
    const hubPositions = new Float32Array(HUBS * 3);
    const hubSizes = new Float32Array(HUBS);
    for (let h = 0; h < HUBS; h++) {
      const p = points[(h * step) % COUNT];
      hubPositions[h * 3] = p.x;
      hubPositions[h * 3 + 1] = p.y;
      hubPositions[h * 3 + 2] = p.z;
      hubSizes[h] = 0.055 * 2.5;
    }
    return { positions, sizes, hubPositions, hubSizes };
  }, [points]);

  const lineGeo = useMemo(() => {
    const verts: number[] = [];
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        if (points[i].distanceTo(points[j]) < LINK_DIST) {
          verts.push(points[i].x, points[i].y, points[i].z, points[j].x, points[j].y, points[j].z);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    return geo;
  }, [points]);

  const rings = useMemo(() => {
    const mat = new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.16, depthWrite: false });
    return [ringGeometry(Math.PI / 2), ringGeometry(Math.PI / 3.5, 0.3), ringGeometry(-Math.PI / 4.2, -0.25)].map(
      (geo) => new THREE.Line(geo, mat)
    );
  }, []);

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime * 1000;

    if (!reduced) {
      g.rotation.y += 0.00026 * delta * 1000;
      // mouse parallax
      const px = (state.pointer.x || 0) * 0.22;
      const py = (state.pointer.y || 0) * 0.16;
      pointer.current.x += (px - pointer.current.x) * 0.07;
      pointer.current.y += (py - pointer.current.y) * 0.07;
      g.rotation.x = -pointer.current.y;
      g.position.x = pointer.current.x * 0.4;
      // breathing
      const s = 1 + Math.sin(t * 0.0008) * 0.018;
      g.scale.setScalar(s);

      // hub pulse — scale the containing group instead of mutating geometry/material
      if (hubGroup.current) {
        hubGroup.current.scale.setScalar(1 + Math.sin(t * 0.0016) * 0.03);
      }
    }
    void size;
  });

  return (
    <group ref={group}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
        </bufferGeometry>
        <pointsMaterial
          map={tex}
          color={GOLD}
          size={0.085}
          sizeAttenuation
          transparent
          depthWrite={false}
          opacity={0.9}
          blending={THREE.AdditiveBlending}
        />
      </points>

      <group ref={hubGroup}>
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[hubPositions, 3]} />
            <bufferAttribute attach="attributes-size" args={[hubSizes, 1]} />
          </bufferGeometry>
          <pointsMaterial
            map={tex}
            color="#f4dc9a"
            size={0.22}
            sizeAttenuation
            transparent
            depthWrite={false}
            opacity={1}
            blending={THREE.AdditiveBlending}
          />
        </points>
      </group>

      <lineSegments geometry={lineGeo}>
        <lineBasicMaterial color={GOLD} transparent opacity={0.15} depthWrite={false} />
      </lineSegments>

      {rings.map((ring, i) => (
        <primitive key={i} object={ring} />
      ))}
    </group>
  );
}

/**
 * WebGL particle globe for the landing hero.
 * Memoized with an always-equal comparator so app-level re-renders (price
 * updates, panel resizing, route state) can never interrupt the WebGL loop.
 */
const GlobeScene = memo(
  ({ className = "" }: { className?: string }) => {
    const reduced = useReducedMotion();
    const [ready, setReady] = useState(false);
    return (
      <div
        className={className}
        aria-hidden
        style={{
          opacity: ready ? undefined : 0,
          transition: "opacity 0.7s ease-out",
          willChange: "transform, opacity",
          transform: "translateZ(0)",
          backfaceVisibility: "hidden",
          pointerEvents: "none",
        }}
      >
        <Canvas
          frameloop="always"
          dpr={Math.min(window.devicePixelRatio || 1, 1)}
          gl={{ alpha: true, antialias: false, powerPreference: "high-performance" }}
          camera={{ fov: 50, position: [0, 0, 5.8] }}
          style={{ background: "transparent", pointerEvents: "none" }}
          onCreated={({ gl }) => {
            gl.shadowMap.enabled = false;
            gl.outputColorSpace = THREE.LinearSRGBColorSpace;
            gl.info.autoReset = false;
            requestAnimationFrame(() => setReady(true));
          }}
        >
          <Globe reduced={reduced} />
        </Canvas>
      </div>
    );
  },
  () => true,
);

GlobeScene.displayName = "GlobeScene";

export default GlobeScene;
