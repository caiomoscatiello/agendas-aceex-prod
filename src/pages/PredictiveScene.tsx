import { useRef, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Stars, Float } from "@react-three/drei";

function CoreMesh() {
  const meshRef = useRef<any>(null);
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.getElapsedTime() * 0.15;
    }
  });

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[2.2, 1]} />
      <meshBasicMaterial color="#8B5CF6" wireframe transparent opacity={0.3} />
    </mesh>
  );
}

export default function PredictiveScene() {
  return (
    <Suspense fallback={<div className="w-full h-full bg-[#0B0E14]" />}>
      <Canvas camera={{ position: [0, 0, 8] }} gl={{ powerPreference: "high-performance" }}>
        <Stars radius={50} count={1500} factor={4} fade speed={1} />
        <Float speed={2} rotationIntensity={1} floatIntensity={1}>
          <CoreMesh />
        </Float>
      </Canvas>
    </Suspense>
  );
}