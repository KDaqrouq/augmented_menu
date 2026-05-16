import Link from "next/link";
import { QuickLookARAnchor } from "./QuickLookARAnchor";

const buttonClassName =
  "inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700";

type ViewInARButtonProps = {
  slug: string;
  itemId: string;
  restaurantId: string;
  isIOS: boolean;
  usdzUrl?: string;
};

/**
 * iOS + USDZ: one tap opens Quick Look (rel="ar").
 * Otherwise: link to the WebXR / 3D viewer page.
 */
export function ViewInARButton({
  slug,
  itemId,
  restaurantId,
  isIOS,
  usdzUrl,
}: ViewInARButtonProps) {
  const arHref = `/r/${slug}/item/${itemId}/ar`;

  if (isIOS && usdzUrl) {
    return (
      <QuickLookARAnchor
        usdzUrl={usdzUrl}
        restaurantId={restaurantId}
        itemId={itemId}
        className={buttonClassName}
      >
        View in AR
      </QuickLookARAnchor>
    );
  }

  return (
    <Link href={arHref} className={buttonClassName}>
      View in AR
    </Link>
  );
}
