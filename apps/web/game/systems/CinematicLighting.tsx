'use client';

// Bloom chỉ lấy vùng sáng cao; bóng tiếp xúc tĩnh ở scene tránh tính shadow map mỗi frame.
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { HalfFloatType, Vector2, WebGLRenderTarget } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export function CinematicLighting({ enabled }: { enabled: boolean }) {
  const { gl, scene, camera, size } = useThree();
  const composer = useRef<EffectComposer | null>(null);
  const bloom = useRef<UnrealBloomPass | null>(null);
  const lastMetric = useRef(0);
  useEffect(() => {
    if (!enabled) return;
    const dimensions = gl.getSize(new Vector2());
    const target = new WebGLRenderTarget(dimensions.x, dimensions.y, { type: HalfFloatType, samples: 2 });
    const pipeline = new EffectComposer(gl, target);
    const glow = new UnrealBloomPass(dimensions, 0.26, 0.35, 0.9);
    const passes = [new RenderPass(scene, camera), glow, new OutputPass()];
    passes.forEach(pass => pipeline.addPass(pass));
    composer.current = pipeline;
    bloom.current = glow;
    glow.setSize(dimensions.x / 2, dimensions.y / 2);
    const previousAutoReset = gl.info.autoReset;
    gl.info.autoReset = false;
    return () => {
      composer.current = null;
      bloom.current = null;
      passes.forEach(pass => pass.dispose());
      pipeline.dispose();
      gl.info.autoReset = previousAutoReset;
    };
  }, [gl, scene, camera, enabled]);
  useEffect(() => {
    composer.current?.setSize(size.width, size.height);
    bloom.current?.setSize(size.width / 2, size.height / 2);
  }, [size]);
  useFrame(({ clock }, delta) => {
    gl.info.reset();
    if (composer.current) composer.current.render(delta);
    else gl.render(scene, camera);
    if (process.env.NODE_ENV !== 'development' || clock.elapsedTime - lastMetric.current < 1) return;
    lastMetric.current = clock.elapsedTime;
    gl.domElement.dataset.renderStats = JSON.stringify({ calls: gl.info.render.calls, triangles: gl.info.render.triangles, textures: gl.info.memory.textures, geometries: gl.info.memory.geometries });
  }, 1);
  return null;
}
