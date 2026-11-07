---
name: blender-asset-pipeline
description: Use when planning, authoring, exporting, validating and optimizing original anime city 3D assets from Blender into glTF/GLB for React Three Fiber; includes optional Blender MCP safety cautions.
---
# Blender to Web GLB asset pipeline

## Modeling workflow
1. Design with reference images and proof of asset license/ownership.
2. Establish units, origin, scale and forward direction for all avatars/buildings/props.
3. Name meshes, materials and armatures predictably; use low-poly stylized geometry where suitable.
4. Bake detail into textures rather than expensive real-time shading when beneficial.
5. Export validated GLB with necessary textures/animations included, and record file size.
6. Test in a small R3F preview then in the actual world scene.
7. Profile mesh counts, texture resolution, VRAM usage, bone counts and animation transitions.

## Blender MCP warning
- Blender MCP can execute Python code inside Blender. Only enable for trustworthy assets/workspaces.
- Use a separate Blender profile or disposable project for experiments; review generated scripts before executing.
- Never allow addons to access personal documents, secret folders or browser profiles.
- Add-on installation is optional. Manual modeling and CLI `blender -b` still work without MCP.

## Deliverables
Use source `.blend`, exported `.glb`, license notes and one screenshot. Avoid bundling huge raw textures unnecessarily.
