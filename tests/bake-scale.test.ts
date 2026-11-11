import { test } from "node:test";
import assert from "node:assert/strict";
import { Document, NodeIO, getBounds } from "@gltf-transform/core";
import { bakeRealWorldScale } from "@/lib/compress-asset";

/** A 2 × 1 × 2 box whose center sits at (5, 3, -1), i.e. off-origin and floating. */
async function boxGlb(): Promise<Buffer> {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const positions = new Float32Array([
    4, 2.5, -2, 6, 2.5, -2, 6, 3.5, -2, 4, 3.5, -2, 4, 2.5, 0, 6, 2.5, 0, 6, 3.5, 0, 4, 3.5, 0,
  ]);
  const indices = new Uint16Array([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  const prim = doc
    .createPrimitive()
    .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(positions).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType("SCALAR").setArray(indices).setBuffer(buffer));
  const mesh = doc.createMesh().addPrimitive(prim);
  const scene = doc.createScene().addChild(doc.createNode().setMesh(mesh));
  doc.getRoot().setDefaultScene(scene);
  return Buffer.from(await new NodeIO().writeBinary(doc));
}

test("baked GLB is scaled, centered on X/Z and sits on Y=0", async () => {
  const baked = await bakeRealWorldScale(await boxGlb(), 0.1);
  const doc = await new NodeIO().readBinary(new Uint8Array(baked));
  const { min, max } = getBounds(doc.getRoot().getDefaultScene()!);

  const close = (a: number, b: number) => Math.abs(a - b) < 1e-6;
  assert.ok(close(max[0] - min[0], 0.2), "width scaled");
  assert.ok(close(max[1] - min[1], 0.1), "height scaled");
  assert.ok(close(min[1], 0), "bottom on the ground");
  assert.ok(close((min[0] + max[0]) / 2, 0) && close((min[2] + max[2]) / 2, 0), "centered");
});

test("invalid scale is refused", async () => {
  await assert.rejects(bakeRealWorldScale(await boxGlb(), 0));
});
