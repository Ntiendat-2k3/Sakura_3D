/**
 * Gộp mesh tĩnh cùng chất liệu thành một mesh để giảm draw call.
 * Cảnh dựng bằng khối JSX (mỗi khối, mắt xích một mesh và material riêng) có hàng trăm draw call;
 * gộp theo chữ ký material còn vài chục, còn React vẫn quản lý cây gốc (chỉ bị ẩn đi).
 */
import { BufferGeometry, Matrix4, Mesh, MeshStandardMaterial, type Object3D } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const KEPT_ATTRIBUTES = ['position', 'normal', 'uv'] as const;

const signature = (material: MeshStandardMaterial) => [
  material.color.getHexString(), material.roughness, material.metalness, material.emissive.getHexString(),
  material.emissiveIntensity, material.map?.uuid ?? '', material.side, material.flatShading,
].join('|');

/** Mesh gộp được: material chuẩn đơn, không trong suốt, không instanced/skinned và không bị đánh dấu động. */
function batchable(object: Object3D): object is Mesh<BufferGeometry, MeshStandardMaterial> {
  if (!(object instanceof Mesh) || !object.visible || object.userData.dynamic) return false;
  if ((object as Mesh & { isInstancedMesh?: boolean; isSkinnedMesh?: boolean }).isInstancedMesh) return false;
  if ((object as Mesh & { isSkinnedMesh?: boolean }).isSkinnedMesh) return false;
  const material = object.material;
  return !Array.isArray(material) && material.type === 'MeshStandardMaterial' && !material.transparent
    && KEPT_ATTRIBUTES.every(name => !!object.geometry.getAttribute(name));
}

/**
 * Gộp mesh con của root (kể cả con cháu) theo chữ ký material; trả hàm hoàn tác (gỡ mesh gộp, hiện lại mesh gốc).
 * Mesh gộp gắn vào root nên dịch chuyển cả root vẫn đúng; cây con không được di chuyển sau khi gộp.
 */
export function batchStaticMeshes(root: Object3D): { undo: () => void; drawCalls: { before: number; after: number } } {
  root.updateWorldMatrix(true, true);
  const toRoot = new Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map<string, { material: MeshStandardMaterial; meshes: Mesh<BufferGeometry, MeshStandardMaterial>[] }>();
  root.traverse(object => {
    if (!batchable(object)) return;
    const key = signature(object.material);
    const group = groups.get(key) ?? { material: object.material, meshes: [] };
    group.meshes.push(object);
    groups.set(key, group);
  });

  const merged: Mesh[] = [], hidden: Mesh[] = [];
  let before = 0;
  for (const { material, meshes } of groups.values()) {
    before += meshes.length;
    if (meshes.length < 2) continue;
    const parts = meshes.map(mesh => {
      const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      const part = new BufferGeometry();
      for (const name of KEPT_ATTRIBUTES) part.setAttribute(name, source.getAttribute(name));
      part.applyMatrix4(new Matrix4().multiplyMatrices(toRoot, mesh.matrixWorld));
      source.dispose();
      return part;
    });
    const geometry = mergeGeometries(parts, false);
    parts.forEach(part => part.dispose());
    if (!geometry) continue;
    const batch = new Mesh(geometry, material);
    batch.name = 'static-batch';
    batch.userData.dynamic = true; // không gộp lại lần nữa nếu root được gộp chồng
    root.add(batch);
    merged.push(batch);
    // Mesh gốc đã ẩn và không bao giờ di chuyển: bỏ khỏi lượt tính ma trận mỗi frame (hàng nghìn node ở Gekkarō).
    for (const mesh of meshes) { mesh.visible = false; mesh.matrixAutoUpdate = false; mesh.matrixWorldAutoUpdate = false; hidden.push(mesh); }
  }
  const after = before - hidden.length + merged.length;
  return {
    drawCalls: { before, after },
    undo() {
      for (const batch of merged) { batch.removeFromParent(); batch.geometry.dispose(); }
      for (const mesh of hidden) { mesh.visible = true; mesh.matrixAutoUpdate = true; mesh.matrixWorldAutoUpdate = true; }
    },
  };
}
