import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, OctahedronGeometry, Vector3 } from 'three';
import { batchStaticMeshes } from '../game/systems/staticBatch';

test('gộp mesh cùng material, giữ đúng vị trí thế giới, bỏ qua mesh trong suốt/động và hoàn tác được', () => {
  const root = new Group();
  root.position.set(10, 0, 0);
  const wood = () => new MeshStandardMaterial({ color: '#3a2010', roughness: 0.5 });
  const a = new Mesh(new BoxGeometry(1, 1, 1), wood()); a.position.set(0, 0, 0);
  const nested = new Group(); nested.position.set(0, 2, 0); nested.rotation.y = Math.PI / 2;
  const b = new Mesh(new BoxGeometry(1, 1, 1), wood()); b.position.set(3, 0, 0); nested.add(b);
  const c = new Mesh(new OctahedronGeometry(0.5), wood()); // không index: vẫn gộp chung được
  const glass = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: '#3a2010', roughness: 0.5, transparent: true, opacity: 0.5 }));
  const flame = new Mesh(new BoxGeometry(1, 1, 1), wood()); flame.userData.dynamic = true;
  const gold = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: '#c9a24a', metalness: 0.8 }));
  root.add(a, nested, c, glass, flame, gold);

  const { undo, drawCalls } = batchStaticMeshes(root);
  // a, b, c gộp thành 1; glass, flame, gold giữ nguyên.
  assert.deepEqual(drawCalls, { before: 4, after: 2 });
  assert.equal([a, b, c].every(mesh => !mesh.visible), true);
  assert.equal(glass.visible && flame.visible && gold.visible, true);
  const batch = root.children.find(child => child.name === 'static-batch') as Mesh;
  batch.geometry.computeBoundingBox();
  root.updateWorldMatrix(true, true);
  const max = batch.geometry.boundingBox!.max.clone().applyMatrix4(root.matrixWorld);
  // b ở (0, 2, -3) trong root sau khi xoay 90°; mép xa nhất theo y là 2.5, theo x (thế giới) là 10.5.
  assert.ok(max.distanceTo(new Vector3(10.5, 2.5, 0.5)) < 1e-6, `bound ${max.toArray()}`);

  undo();
  assert.equal(root.children.some(child => child.name === 'static-batch'), false);
  assert.equal([a, b, c].every(mesh => mesh.visible), true);
});
