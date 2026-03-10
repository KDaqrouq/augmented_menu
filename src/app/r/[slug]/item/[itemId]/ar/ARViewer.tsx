"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";
import { Canvas } from "@react-three/fiber";
import { useGLTF, OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import {
  createXRStore,
  XR,
  useXR,
  useXRHitTest,
  useXRSessionModeSupported,
  IfInSessionMode,
  XRDomOverlay,
} from "@react-three/xr";
import { Matrix4, Vector3, Euler, Plane, Mesh } from "three";
import { trackEvent } from "@/lib/analytics";

type ARViewerProps = {
  restaurantId: string;
  itemId: string;
  glbUrl: string;
  usdzUrl?: string;
  scaleFactor: number;
  itemName: string;
  measurementType: string;
  measurementValueCm: number;
  bboxX: number;
  bboxY: number;
  bboxZ: number;
};

/** iOS Quick Look: open USDZ in AR. Fallback: we show 3D viewer below. */
function QuickLookLink({
  usdzUrl,
  itemName,
}: {
  usdzUrl: string;
  itemName: string;
}) {
  return (
    <a
      href={usdzUrl}
      rel="ar"
      className="absolute right-3 top-3 z-10 rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
    >
      Open in AR (iOS)
    </a>
  );
}

function Model({
  url,
  scale,
  clippingPlane,
}: {
  url: string;
  scale: number;
  clippingPlane?: Plane | null;
}) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(), [scene]);

  useEffect(() => {
    if (!clippingPlane) return;
    cloned.traverse((obj) => {
      if (obj instanceof Mesh && obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => {
          m.clippingPlanes = [clippingPlane];
        });
      }
    });
    return () => {
      cloned.traverse((obj) => {
        if (obj instanceof Mesh && obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => {
            m.clippingPlanes = [];
          });
        }
      });
    };
  }, [cloned, clippingPlane]);

  return <primitive object={cloned} scale={scale} />;
}

/** Enable renderer clipping for occlusion planes */
function EnableClipping() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.localClippingEnabled = true;
    return () => {
      gl.localClippingEnabled = false;
    };
  }, [gl]);
  return null;
}

/** Desktop 3D viewer (non-AR) */
function DesktopScene({
  glbUrl,
  scaleFactor,
}: {
  glbUrl: string;
  scaleFactor: number;
}) {
  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <Suspense fallback={null}>
        <Model url={glbUrl} scale={scaleFactor} />
      </Suspense>
      <OrbitControls makeDefault />
    </>
  );
}

/** AR placement: hit-test preview, tap to place, move/rotate when placed */
function ARPlacementSceneWithFrameUpdate({
  glbUrl,
  scaleFactor,
  onPlaceSuccess,
}: {
  glbUrl: string;
  scaleFactor: number;
  onPlaceSuccess?: () => void;
}) {
  const matrixHelper = useMemo(() => new Matrix4(), []);
  const hitTestPosition = useRef(new Vector3());
  const hitTestQuaternion = useRef(new Euler());
  const [, forceUpdate] = useState(0);

  const [placed, setPlaced] = useState(false);
  const [placePosition, setPlacePosition] = useState<Vector3 | null>(null);
  const [placeRotation, setPlaceRotation] = useState<Euler | null>(null);
  const [placeOcclusionPlane, setPlaceOcclusionPlane] = useState<Plane | null>(null);
  const [rotationY, setRotationY] = useState(0);

  const placeAtHitTest = useCallback(() => {
    const pos = hitTestPosition.current.clone();
    const rot = new Euler().copy(hitTestQuaternion.current);
    const normal = new Vector3(0, 1, 0).applyEuler(rot).normalize();
    const plane = new Plane().setFromNormalAndCoplanarPoint(normal, pos);
    setPlacePosition(pos);
    setPlaceRotation(rot);
    setPlaceOcclusionPlane(plane);
    setPlaced(true);
    onPlaceSuccess?.();
  }, [onPlaceSuccess]);

  const pickUp = useCallback(() => {
    setPlaced(false);
    setPlacePosition(null);
    setPlaceRotation(null);
    setPlaceOcclusionPlane(null);
  }, []);

  const rotate90 = useCallback(() => {
    setRotationY((r) => (r + Math.PI / 2) % (2 * Math.PI));
  }, []);

  const placedRef = useRef(placed);
  placedRef.current = placed;

  const session = useXR((s) => s.session);
  const depthLogged = useRef(false);
  if (session && !depthLogged.current) {
    const hasDepth = session.enabledFeatures?.includes("depth-sensing");
    if (!hasDepth) {
      console.log("depth occlusion not supported");
      depthLogged.current = true;
    }
  }

  useXRHitTest(
    (results, getWorldMatrix) => {
      if (results.length === 0) return;
      getWorldMatrix(matrixHelper, results[0]);
      hitTestPosition.current.setFromMatrixPosition(matrixHelper);
      hitTestQuaternion.current.setFromRotationMatrix(matrixHelper);
      if (!placedRef.current) forceUpdate((n) => n + 1);
    },
    "viewer",
    ["plane", "mesh"]
  );

  const handleSelect = useCallback(() => {
    if (placedRef.current) return;
    placeAtHitTest();
  }, [placeAtHitTest]);

  useEffect(() => {
    if (!session) return;
    session.addEventListener("select", handleSelect);
    return () => session.removeEventListener("select", handleSelect);
  }, [session, handleSelect]);

  return (
    <>
      <EnableClipping />
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 5, 5]} intensity={1} />

      {!placed && (
        <group
          position={hitTestPosition.current}
          rotation={hitTestQuaternion.current}
        >
          <Suspense fallback={null}>
            <Model url={glbUrl} scale={scaleFactor} />
          </Suspense>
        </group>
      )}

      {placed && placePosition && (
        <group position={placePosition} rotation={placeRotation!}>
          <group rotation={[0, rotationY, 0]}>
            <Suspense fallback={null}>
              <Model
                url={glbUrl}
                scale={scaleFactor}
                clippingPlane={placeOcclusionPlane}
              />
            </Suspense>
          </group>
        </group>
      )}

      <IfInSessionMode allow="immersive-ar">
        <XRDomOverlay>
          <div className="fixed bottom-4 left-4 right-4 flex flex-col gap-2 rounded bg-black/70 p-3 text-white">
            {!placed ? (
              <p className="text-sm">Point at a surface and tap to place</p>
            ) : (
              <>
                <p className="text-sm">Use buttons to rotate or pick up</p>
                <p className="text-xs text-gray-300">
                  Limited occlusion (table-plane only)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={rotate90}
                    className="rounded bg-gray-600 px-3 py-1.5 text-sm hover:bg-gray-500"
                  >
                    Rotate 90°
                  </button>
                  <button
                    onClick={pickUp}
                    className="rounded bg-gray-600 px-3 py-1.5 text-sm hover:bg-gray-500"
                  >
                    Pick up
                  </button>
                </div>
              </>
            )}
          </div>
        </XRDomOverlay>
      </IfInSessionMode>
    </>
  );
}

function SceneContent({
  glbUrl,
  scaleFactor,
  onPlaceSuccess,
}: {
  glbUrl: string;
  scaleFactor: number;
  onPlaceSuccess?: () => void;
}) {
  const mode = useXR((s) => s.mode);

  if (mode === "immersive-ar") {
    return (
      <ARPlacementSceneWithFrameUpdate
        glbUrl={glbUrl}
        scaleFactor={scaleFactor}
        onPlaceSuccess={onPlaceSuccess}
      />
    );
  }
  return <DesktopScene glbUrl={glbUrl} scaleFactor={scaleFactor} />;
}

export function ARViewer({
  restaurantId,
  itemId,
  glbUrl,
  usdzUrl,
  scaleFactor,
  itemName,
  measurementType,
  measurementValueCm,
  bboxX,
  bboxY,
  bboxZ,
}: ARViewerProps) {
  const isDev = process.env.NODE_ENV === "development";
  const targetMeters = measurementValueCm / 100;

  const xrStore = useMemo(
    () =>
      createXRStore({
        offerSession: "immersive-ar",
        planeDetection: true,
        hitTest: true,
        // Disable hand/controller models for simpler AR placement UX
        hand: false,
        controller: false,
      }),
    []
  );

  const arSupported = useXRSessionModeSupported("immersive-ar");
  const inAR = useStore(xrStore, (s) => s.mode === "immersive-ar");

  useEffect(() => {
    const arMode = usdzUrl ? "quicklook" : arSupported ? "webxr" : "3dviewer";
    trackEvent("ar_open", { restaurantId, itemId, arMode });
    trackEvent("ar_supported", {
      restaurantId,
      itemId,
      arSupported: !!arSupported,
      reason: arSupported ? "webxr" : usdzUrl ? "quicklook" : "fallback",
    });
  }, [restaurantId, itemId, usdzUrl, arSupported]);

  const [arError, setArError] = useState<string | null>(null);

  const enterAR = useCallback(async () => {
    setArError(null);
    try {
      await xrStore.enterAR();
      trackEvent("ar_permission_result", {
        restaurantId,
        itemId,
        result: "granted",
      });
    } catch (e) {
      const msg =
        e instanceof Error && e.name === "NotAllowedError"
          ? "Camera permission denied."
          : "Could not start AR. Please try again.";
      setArError(msg);
      trackEvent("ar_permission_result", {
        restaurantId,
        itemId,
        result: "denied",
      });
    }
  }, [xrStore, restaurantId, itemId]);

  const showArNotSupported = !usdzUrl && !arSupported;

  useEffect(() => {
    if (showArNotSupported) {
      trackEvent("ar_fallback_used", {
        restaurantId,
        itemId,
        arMode: "3dviewer",
      });
    }
  }, [showArNotSupported, restaurantId, itemId]);

  return (
    <>
      {usdzUrl && <QuickLookLink usdzUrl={usdzUrl} itemName={itemName} />}
      {showArNotSupported && (
        <div className="absolute left-3 right-3 top-14 z-10 rounded-lg border border-amber-600/50 bg-amber-900/95 px-4 py-3 text-center shadow-lg">
          <p className="font-medium text-amber-100">
            AR not supported on this device
          </p>
          <p className="mt-1 text-sm text-amber-200">
            Viewing in 3D. Use an AR-capable device for full experience.
          </p>
        </div>
      )}
      {arError && (
        <div className="absolute left-3 right-3 top-14 z-10 rounded-lg border border-red-600/50 bg-red-900/95 px-4 py-3 text-center shadow-lg">
          <p className="font-medium text-red-100">{arError}</p>
          <button
            onClick={() => setArError(null)}
            className="mt-2 rounded bg-red-700 px-3 py-1 text-sm text-white hover:bg-red-600"
          >
            Dismiss
          </button>
        </div>
      )}
      <div className="fixed inset-0">
        <Canvas camera={{ position: [2, 2, 2], fov: 50 }}>
          <XR store={xrStore}>
            <SceneContent
              glbUrl={glbUrl}
              scaleFactor={scaleFactor}
              onPlaceSuccess={() =>
                trackEvent("ar_place_success", { restaurantId, itemId })
              }
            />
          </XR>
        </Canvas>
        {arSupported && !inAR && (
          <button
            onClick={enterAR}
            className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
          >
            Enter AR
          </button>
        )}
      </div>
      {isDev && (
        <div className="pointer-events-none fixed bottom-20 left-4 right-4 z-20 rounded bg-black/70 p-3 font-mono text-xs text-green-400">
          <div>Item: {itemName}</div>
          <div>
            Target: {measurementValueCm} cm = {targetMeters.toFixed(4)} m
          </div>
          <div>
            Bbox (m): X={bboxX.toFixed(4)} Y={bboxY.toFixed(4)} Z=
            {bboxZ.toFixed(4)}
          </div>
          <div>Measurement: {measurementType}</div>
          <div>Scale factor: {scaleFactor.toFixed(4)}</div>
        </div>
      )}
    </>
  );
}
