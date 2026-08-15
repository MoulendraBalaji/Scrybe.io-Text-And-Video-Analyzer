/* ============================================================
   R3FOrb — the WebGL Pulse Orb.
   Custom GLSL shader: simplex-noise vertex displacement with
   flat-shaded facets (clay), red→blue mix, fresnel rim + top
   light. Idle breathing on the hero; live deformation in the
   workspace. Respects the page's reduced-motion (not rendered
   there — PulseOrb gates it).
   ============================================================ */

import { useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uAmplitude;
  varying vec3 vPos;

  // ---- Simplex noise (Stefan Gustavson, public domain / CC) ----
  vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
  float snoise(vec3 v){
    const vec2 C=vec2(1.0/6.0,1.0/3.0);
    const vec4 D=vec4(0.0,0.5,1.0,2.0);
    vec3 i=floor(v+dot(v,C.yyy));
    vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz);
    vec3 l=1.0-g;
    vec3 i1=min(g.xyz,l.zxy);
    vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx;
    vec3 x2=x0-i2+C.yyy;
    vec3 x3=x0-D.yyy;
    i=mod289(i);
    vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
    float n_=0.142857142857;
    vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.0*floor(p*ns.z*ns.z);
    vec4 x_=floor(j*ns.z);
    vec4 y_=floor(j-7.0*x_);
    vec4 x=x_*ns.x+ns.yyyy;
    vec4 y=y_*ns.x+ns.yyyy;
    vec4 h=1.0-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy);
    vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.0+1.0;
    vec4 s1=floor(b1)*2.0+1.0;
    vec4 sh=-step(h,vec4(0.0));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
    vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x);
    vec3 p1=vec3(a0.zw,h.y);
    vec3 p2=vec3(a1.xy,h.z);
    vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
    vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
    m=m*m;
    return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }

  void main(){
    float n1 = snoise(position * 1.55 + uTime * 0.32);
    float n2 = snoise(position * 3.1 - uTime * 0.18);
    float disp = (n1 * 0.6 + n2 * 0.4) * uAmplitude;
    vec3 newPos = position + normal * disp;
    vPos = newPos;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uMix;
  uniform float uTime;
  varying vec3 vPos;

  void main(){
    vec3 fdx = dFdx(vPos);
    vec3 fdy = dFdy(vPos);
    vec3 N = normalize(cross(fdx, fdy));
    vec3 V = normalize(-vPos);
    vec3 base = mix(uColorA, uColorB, uMix);
    float up = pow(clamp(N.y * 0.5 + 0.5, 0.0, 1.0), 2.2);
    float rim = pow(1.0 - max(dot(N, V), 0.0), 3.2);
    vec3 col = base * (0.5 + up * 0.85) + vec3(0.22, 0.28, 0.34) * rim;
    col += base * (sin(uTime * 1.5) * 0.05 + 0.07);
    gl_FragColor = vec4(col, 1.0);
  }
`;

function OrbMesh({ mode, signal }) {
  const mesh = useRef(null);
  const target = useRef({ mix: 0.45, amp: 0.28 });

  useEffect(() => {
    target.current.mix = mode === 'live' ? signal : 0.5;
    target.current.amp = mode === 'live' ? 0.2 + signal * 0.3 : 0.28;
  }, [signal, mode]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const mat = mesh.current && mesh.current.material;
    if (mat) {
      mat.uniforms.uTime.value = t;
      mat.uniforms.uMix.value += (target.current.mix - mat.uniforms.uMix.value) * Math.min(1, delta * 3);
      mat.uniforms.uAmplitude.value += (target.current.amp - mat.uniforms.uAmplitude.value) * Math.min(1, delta * 2);
    }

    if (mesh.current) {
      const speed = mode === 'live' ? 0.28 + signal * 0.3 : 0.18;
      mesh.current.rotation.y += delta * speed;
      mesh.current.rotation.x = Math.sin(t * 0.22) * 0.16;
      mesh.current.rotation.z = Math.cos(t * 0.17) * 0.1;
      const s = mode === 'live' ? 0.97 + Math.sin(t * 1.6) * 0.02 + signal * 0.02 : 1;
      mesh.current.scale.setScalar(s);
    }
  });

  return (
    <mesh ref={mesh}>
      <shaderMaterial
        vertexShader={VERT}
        fragmentShader={FRAG}
        flatShading
        uniforms={{
          uTime: { value: 0 },
          uAmplitude: { value: 0.28 },
          uMix: { value: 0.45 },
          uColorA: { value: new THREE.Color('#E0435B') },
          uColorB: { value: new THREE.Color('#3554E8') },
        }}
      />
      <icosahedronGeometry args={[1.15, 40]} />
    </mesh>
  );
}

export default function R3FOrb({ mode = 'idle', signal = 0.5 }) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 5.2], fov: 40 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'transparent' }}
      aria-hidden="true"
    >
      <OrbMesh mode={mode} signal={signal} />
    </Canvas>
  );
}
