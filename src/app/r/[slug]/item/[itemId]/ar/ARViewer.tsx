"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";
import { Canvas } from "@react-three/fiber";
import { Bounds, ContactShadows, Html, OrbitControls, useGLTF, useProgress } from "@react-three/drei";
import {
  createXRStore,
  XR,
  useXR,
  useXRHitTest,
  useXRSessionModeSupported,
  IfInSessionMode,
  XRDomOverlay,
} from "@react-three/xr";
import { Box3, Euler, Matrix4, Mesh, Plane, Vector3, type Group } from "three";
import { trackEvent } from "@/lib/analytics";
import type { MobilePlatform } from "@/lib/device";
import { MEASUREMENT_LABELS, type MeasurementType } from "@/lib/measurement";
import { buttonClass } from "@/components/ui";
import { CubeIcon, HandIcon, RotateIcon } from "@/components/icons";
import { TrackedARLink } from "../TrackedARLink";

type ARViewerProps = {
  restaurantId: string;
  itemId: string;
  itemName: string;
  platform: MobilePlatform;
  glbUrl: string;
  usdzUrl?: string;
  scaleFactor: number;
  measurementType: MeasurementType;
  measurementValueCm: number;
  bboxX: number;
  bboxY: number;
  bboxZ: number;
};

/**
 * Loads the GLB at real-world scale, centered on X/Z with its lowest point at Y=0,
 * so it sits on the table (WebXR) or the ground shadow (3D view) instead of sinking into it.
 */
function Model({ url, scale, clippingPlane }: { url: string; scale: number; clippingPlane?: Plane | null }) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const offset = useMemo(() => {
    const box = new Box3().setFromObject(cloned);
    const center = box.getCenter(new Vector3());
    return [-center.x, -box.min.y, -center.z] as [number, number, number];
  }, [cloned]);

  useEffect(() => {
    if (!clippingPlane) return;
    const apply = (planes: Plane[]) =>
      cloned.traverse((obj) => {
        if (obj instanceof Mesh && obj.material) {
          (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach((m) => {
            m.clippingPlanes = planes;
          });
        }
      });
    apply([clippingPlane]);
    return () => apply([]);
  }, [cloned, clippingPlane]);

  return (
    <group scale={scale}>
      <primitive object={cloned} position={offset} />
    </group>
  );
}

function LoadingLabel() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="whitespace-nowrap rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-stone-700 shadow-lift">
        Loading dish… {Math.round(progress)}%
      </div>
    </Html>
  );
}

/** 3D viewer (no AR): framed to the dish, with a soft ground shadow. */
function ViewerScene({ glbUrl, scaleFactor }: { glbUrl: string; scaleFactor: number }) {
  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 5, 2]} intensity={1.4} />
      <directionalLight position={[-3, 2, -2]} intensity={0.4} />
      <Suspense fallback={<LoadingLabel />}>
        <Bounds fit clip observe margin={1.5}>
          <Model url={glbUrl} scale={scaleFactor} />
        </Bounds>
        <ContactShadows position={[0, 0, 0]} opacity={0.45} scale={2} blur={2.4} far={1} />
      </Suspense>
      <OrbitControls makeDefault enablePan={false} minPolarAngle={0.2} maxPolarAngle={Math.PI / 2 - 0.05} />
    </>
  );
}

/** Ring shown on the detected surface before the dish is placed. */
function Reticle() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.07, 0.085, 48]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
    </mesh>
  );
}

/** WebXR placement: reticle + preview on the surface, tap to place, then rotate / pick up. */
function ARPlacementScene({
  glbUrl,
  scaleFactor,
  onPlaceSuccess,
}: {
  glbUrl: string;
  scaleFactor: number;
  onPlaceSuccess?: () => void;
}) {
  const matrixHelper = useMemo(() => new Matrix4(), []);
  const previewRef = useRef<Group>(null);
  const hitPosition = useRef(new Vector3());
  const hitRotation = useRef(new Euler());
  const [hasHit, setHasHit] = useState(false);
  const [placed, setPlaced] = useState<{ position: Vector3; rotation: Euler; plane: Plane } | null>(null);
  const [rotationY, setRotationY] = useState(0);

  useXRHitTest(
    (results, getWorldMatrix) => {
      if (results.length === 0) return;
      getWorldMatrix(matrixHelper, results[0]);
      hitPosition.current.setFromMatrixPosition(matrixHelper);
      hitRotation.current.setFromRotationMatrix(matrixHelper);
      if (previewRef.current) {
        previewRef.current.position.copy(hitPosition.current);
        previewRef.current.rotation.copy(hitRotation.current);
      }
      if (!hasHit) setHasHit(true);
    },
    "viewer",
    ["plane", "mesh"]
  );

  const place = useCallback(() => {
    if (placed || !hasHit) return;
    const position = hitPosition.current.clone();
    const rotation = hitRotation.current.clone();
    const normal = new Vector3(0, 1, 0).applyEuler(rotation).normalize();
    setPlaced({ position, rotation, plane: new Plane().setFromNormalAndCoplanarPoint(normal, position) });
    onPlaceSuccess?.();
  }, [placed, hasHit, onPlaceSuccess]);

  const session = useXR((s) => s.session);
  useEffect(() => {
    if (!session) return;
    session.addEventListener("select", place);
    return () => session.removeEventListener("select", place);
  }, [session, place]);

  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 5, 2]} intensity={1.2} />

      {!placed && (
        <group ref={previewRef} visible={hasHit}>
          <Reticle />
          <Suspense fallback={null}>
            <Model url={glbUrl} scale={scaleFactor} />
          </Suspense>
        </group>
      )}

      {placed && (
        <group position={placed.position} rotation={placed.rotation}>
          <group rotation={[0, rotationY, 0]}>
            <Suspense fallback={null}>
              <Model url={glbUrl} scale={scaleFactor} clippingPlane={placed.plane} />
            </Suspense>
          </group>
        </group>
      )}

      <IfInSessionMode allow="immersive-ar">
        <XRDomOverlay>
          <div className="pb-safe fixed inset-x-3 bottom-3 rounded-2xl bg-black/70 p-4 text-white backdrop-blur">
            {!placed ? (
              <p className="text-center text-sm font-medium">
                {hasHit ? "Tap to place the dish here" : "Slowly move your phone to find the table"}
              </p>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm">Placed at real size</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setRotationY((r) => (r + Math.PI / 4) % (2 * Math.PI))}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white/15 px-3 text-sm font-medium hover:bg-white/25"
                  >
                    <RotateIcon size={16} /> Rotate
                  </button>
                  <button
                    onClick={() => setPlaced(null)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white/15 px-3 text-sm font-medium hover:bg-white/25"
                  >
                    <HandIcon size={16} /> Move
                  </button>
                </div>
              </div>
            )}
          </div>
        </XRDomOverlay>
      </IfInSessionMode>
    </>
  );
}

function SceneContent(props: { glbUrl: string; scaleFactor: number; onPlaceSuccess?: () => void }) {
  const mode = useXR((s) => s.mode);
  if (mode === "immersive-ar") return <ARPlacementScene {...props} />;
  return <ViewerScene glbUrl={props.glbUrl} scaleFactor={props.scaleFactor} />;
}

export function ARViewer({
  restaurantId,
  itemId,
  itemName,
  platform,
  glbUrl,
  usdzUrl,
  scaleFactor,
  measurementType,
  measurementValueCm,
  bboxX,
  bboxY,
  bboxZ,
}: ARViewerProps) {
  const isDev = process.env.NODE_ENV === "development";

  const xrStore = useMemo(
    () =>
      createXRStore({
        offerSession: false,
        planeDetection: true,
        hitTest: true,
        domOverlay: true,
        // No hand/controller models: simpler placement UX.
        hand: false,
        controller: false,
      }),
    []
  );

  const arSupported = useXRSessionModeSupported("immersive-ar");
  const inAR = useStore(xrStore, (s) => s.mode === "immersive-ar");
  const quickLookUrl = platform === "ios" ? usdzUrl : undefined;
  const [arError, setArError] = useState<string | null>(null);

  // This page is the in-browser viewer; native Quick Look / Scene Viewer opens are tracked on their links.
  useEffect(() => {
    trackEvent("ar_open", { restaurantId, itemId, arMode: "3dviewer" });
  }, [restaurantId, itemId]);

  useEffect(() => {
    if (arSupported === undefined) return;
    trackEvent("ar_supported", { restaurantId, itemId, arSupported });
    if (!arSupported && !quickLookUrl) trackEvent("ar_fallback_used", { restaurantId, itemId, arMode: "3dviewer" });
  }, [arSupported, quickLookUrl, restaurantId, itemId]);

  const enterAR = useCallback(async () => {
    setArError(null);
    try {
      await xrStore.enterAR();
      trackEvent("ar_permission_result", { restaurantId, itemId, result: "granted" });
      trackEvent("ar_open", { restaurantId, itemId, arMode: "webxr" });
    } catch (e) {
      const denied = e instanceof Error && e.name === "NotAllowedError";
      setArError(denied ? "Camera access was denied. Allow it in your browser settings to use AR." : "Couldn’t start AR. Please try again.");
      trackEvent("ar_permission_result", { restaurantId, itemId, result: denied ? "denied" : "error" });
    }
  }, [xrStore, restaurantId, itemId]);

  const sizeText = `${Number(measurementValueCm.toFixed(1))} cm ${MEASUREMENT_LABELS[measurementType]?.label.toLowerCase() ?? ""}`;

  return (
    <>
      <div className="absolute inset-0">
        <Canvas
          camera={{ position: [0.6, 0.5, 0.6], fov: 40, near: 0.01, far: 50 }}
          dpr={[1, 2]}
          // Needed for the table-plane occlusion of a placed dish.
          onCreated={({ gl }) => {
            gl.localClippingEnabled = true;
          }}
        >
          <XR store={xrStore}>
            <SceneContent
              glbUrl={glbUrl}
              scaleFactor={scaleFactor}
              onPlaceSuccess={() => trackEvent("ar_place_success", { restaurantId, itemId })}
            />
          </XR>
        </Canvas>
      </div>

      {!inAR && (
        <div className="pb-safe absolute inset-x-0 bottom-0 z-10 px-4">
          <div className="mx-auto max-w-md space-y-3 rounded-3xl bg-white/90 p-4 shadow-lift backdrop-blur">
            {arError && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{arError}</p>}
            <div className="flex items-center justify-between gap-3 text-sm text-stone-600">
              <span>
                Real size: <span className="font-medium text-stone-900">{sizeText}</span>
              </span>
              <span className="hidden items-center gap-1 sm:inline-flex">
                <HandIcon size={16} /> Drag to turn
              </span>
            </div>
            {arSupported ? (
              <button onClick={enterAR} className={buttonClass("primary", "lg", "w-full")}>
                <CubeIcon size={20} /> Place on your table
              </button>
            ) : quickLookUrl ? (
              <TrackedARLink
                href={quickLookUrl}
                arMode="quicklook"
                restaurantId={restaurantId}
                itemId={itemId}
                className={buttonClass("primary", "lg", "w-full")}
              >
                <CubeIcon size={20} /> Place on your table
              </TrackedARLink>
            ) : (
              arSupported === false && (
                <p className="text-center text-xs text-stone-500">
                  AR isn’t available in this browser. Open this page on a recent iPhone or Android phone to place{" "}
                  {itemName} on your table.
                </p>
              )
            )}
          </div>
        </div>
      )}

      {isDev && !inAR && (
        <div className="pointer-events-none absolute left-3 top-16 z-10 rounded-lg bg-black/70 p-2 font-mono text-[11px] leading-relaxed text-green-400">
          <div>target {measurementValueCm} cm ({measurementType})</div>
          <div>
            bbox m {bboxX.toFixed(3)} × {bboxY.toFixed(3)} × {bboxZ.toFixed(3)}
          </div>
          <div>scale {scaleFactor.toFixed(4)}</div>
        </div>
      )}
    </>
  );
}
