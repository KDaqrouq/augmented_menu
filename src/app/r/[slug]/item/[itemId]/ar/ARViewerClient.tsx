"use client";

import dynamic from "next/dynamic";
import { Spinner } from "@/components/ui";

/**
 * The viewer needs WebGL and the WebXR APIs, and @react-three/xr's hooks can't
 * render on the server, so it is only ever rendered in the browser.
 */
export const ARViewerClient = dynamic(() => import("./ARViewer").then((m) => m.ARViewer), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-stone-600">
      <Spinner /> Loading 3D viewer…
    </div>
  ),
});
