"use client";
import { ContactShadows, Float, RoundedBox } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/** Soft, slightly cartoonish clay material. */
function Clay({ color, rough = 0.62 }: { color: string; rough?: number }) {
  return <meshStandardMaterial color={color} roughness={rough} metalness={0.02} />;
}

function Shield(props: any) {
  return (
    <group {...props}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.62, 0.62, 0.22, 48]} />
        <Clay color="#7ddcb4" />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.12]}>
        <torusGeometry args={[0.5, 0.06, 16, 48]} />
        <Clay color="#ffffff" />
      </mesh>
      {/* check mark */}
      <RoundedBox args={[0.16, 0.42, 0.12]} radius={0.06} position={[-0.12, -0.05, 0.16]} rotation={[0, 0, 0.75]}><Clay color="#ffffff" /></RoundedBox>
      <RoundedBox args={[0.16, 0.7, 0.12]} radius={0.06} position={[0.12, 0.06, 0.16]} rotation={[0, 0, -0.6]}><Clay color="#ffffff" /></RoundedBox>
    </group>
  );
}

function Coins(props: any) {
  return (
    <group {...props}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[i * 0.04, i * 0.17, 0]} castShadow>
          <cylinderGeometry args={[0.38, 0.38, 0.15, 40]} />
          <Clay color={i === 2 ? "#ffd970" : "#ffcc4d"} />
        </mesh>
      ))}
    </group>
  );
}

function Bubble(props: any) {
  return (
    <group {...props}>
      <RoundedBox args={[1.25, 0.8, 0.32]} radius={0.16} smoothness={6} castShadow><Clay color="#a9d4ff" /></RoundedBox>
      <mesh position={[-0.38, -0.46, 0]} rotation={[0, 0, 0.6]}>
        <coneGeometry args={[0.16, 0.3, 24]} />
        <Clay color="#a9d4ff" />
      </mesh>
      {[-0.3, 0, 0.3].map((x) => (
        <mesh key={x} position={[x, 0, 0.18]}><sphereGeometry args={[0.08, 24, 24]} /><Clay color="#ffffff" /></mesh>
      ))}
    </group>
  );
}

function Plane(props: any) {
  // Telegram-style paper plane from a flattened tetrahedron.
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const v = new Float32Array([0, 0, 0.9, -0.55, 0, -0.5, 0.55, 0, -0.5, 0, 0.28, -0.3, 0, -0.12, -0.35]);
    g.setAttribute("position", new THREE.BufferAttribute(v, 3));
    g.setIndex([0, 1, 3, 0, 3, 2, 0, 4, 1, 0, 2, 4, 1, 4, 3, 2, 3, 4]);
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geo} castShadow {...props}>
      <meshStandardMaterial color="#6fb8ff" roughness={0.55} flatShading side={THREE.DoubleSide} />
    </mesh>
  );
}

function Sheet(props: any) {
  return (
    <group {...props}>
      <RoundedBox args={[1.05, 1.25, 0.16]} radius={0.12} smoothness={5} castShadow><Clay color="#8fe0a8" /></RoundedBox>
      {[0, 1, 2, 3].map((r) => [0, 1].map((c) => (
        <RoundedBox key={`${r}-${c}`} args={[0.36, 0.17, 0.05]} radius={0.04} position={[-0.2 + c * 0.42, 0.38 - r * 0.25, 0.09]}>
          <Clay color={r === 0 ? "#3fae6a" : "#ffffff"} />
        </RoundedBox>
      )))}
    </group>
  );
}

function Phone(props: any) {
  return (
    <group {...props}>
      <RoundedBox args={[0.7, 1.32, 0.14]} radius={0.12} smoothness={6} castShadow><Clay color="#ffb98a" /></RoundedBox>
      <RoundedBox args={[0.56, 1.02, 0.03]} radius={0.06} position={[0, 0.04, 0.075]}><Clay color="#fff7ef" rough={0.4} /></RoundedBox>
      <mesh position={[0, 0.2, 0.1]}><sphereGeometry args={[0.13, 24, 24]} /><Clay color="#34d399" /></mesh>
      <RoundedBox args={[0.36, 0.07, 0.03]} radius={0.03} position={[0, -0.05, 0.095]}><Clay color="#cbd5e1" /></RoundedBox>
      <RoundedBox args={[0.26, 0.07, 0.03]} radius={0.03} position={[0, -0.17, 0.095]}><Clay color="#e2e8f0" /></RoundedBox>
    </group>
  );
}

function Pill({ color, ...props }: any) {
  return (
    <mesh castShadow {...props}>
      <capsuleGeometry args={[0.1, 0.22, 8, 16]} />
      <Clay color={color} />
    </mesh>
  );
}

function Rig({ children }: { children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    if (!group.current) return;
    const tx = state.pointer.x * 0.35;
    const ty = -state.pointer.y * 0.18;
    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, tx, 3, delta);
    group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, ty, 3, delta);
  });
  return <group ref={group}>{children}</group>;
}

export default function ClayScene({ still = false }: { still?: boolean }) {
  const speed = still ? 0 : 1;
  return (
    <Canvas dpr={[1, 1.75]} camera={{ position: [0, 0, 9.5], fov: 38 }} frameloop={still ? "demand" : "always"} gl={{ antialias: true, alpha: true }} shadows>
      <ambientLight intensity={0.85} />
      <hemisphereLight args={["#ffffff", "#e8f6f0", 0.7]} />
      <directionalLight position={[3, 5, 4]} intensity={1.15} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-4, 2, 2]} intensity={0.35} color="#ffe7cf" />
      <Rig>
        <Float speed={1.6 * speed} rotationIntensity={0.6} floatIntensity={1.1}><Shield position={[-2.35, 1.25, 0]} rotation={[0.2, 0.45, -0.15]} /></Float>
        <Float speed={1.3 * speed} rotationIntensity={0.5} floatIntensity={0.9}><Coins position={[2.45, -1.25, 0.2]} rotation={[0.4, 0.2, 0.25]} /></Float>
        <Float speed={1.8 * speed} rotationIntensity={0.7} floatIntensity={1.2}><Bubble position={[2.3, 1.45, -0.3]} rotation={[0.1, -0.4, 0.08]} scale={0.85} /></Float>
        <Float speed={2.1 * speed} rotationIntensity={1} floatIntensity={1.4}><Plane position={[-2.45, -1.15, 0.4]} rotation={[0.4, 0.9, 0.3]} scale={0.95} /></Float>
        <Float speed={1.4 * speed} rotationIntensity={0.5} floatIntensity={0.8}><Sheet position={[2.9, 0.1, -1]} rotation={[0.1, -0.6, 0.05]} scale={0.8} /></Float>
        <Float speed={1.5 * speed} rotationIntensity={0.6} floatIntensity={0.9}><Phone position={[-3.0, 0.15, -1.1]} rotation={[0.1, 0.6, -0.1]} scale={0.85} /></Float>
        <Float speed={2.6 * speed} floatIntensity={2}><Pill color="#c4b5fd" position={[0.9, 2.15, -1.4]} rotation={[0, 0, 0.8]} /></Float>
        <Float speed={2.3 * speed} floatIntensity={2}><Pill color="#fda4af" position={[-0.8, -2.05, -0.8]} rotation={[0, 0, -0.6]} /></Float>
        <Float speed={2.8 * speed} floatIntensity={2}><Pill color="#fde68a" position={[-1.3, 2.25, -1.6]} rotation={[0.4, 0, 1.2]} /></Float>
        <Float speed={2.4 * speed} floatIntensity={2}><mesh position={[1.4, -2.2, -1]}><sphereGeometry args={[0.16, 32, 32]} /><Clay color="#7ddcb4" /></mesh></Float>
      </Rig>
      <ContactShadows position={[0, -2.6, 0]} opacity={0.12} scale={12} blur={3.2} far={4.5} color="#1f4d3f" />
    </Canvas>
  );
}
