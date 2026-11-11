import { Badge, Spinner } from "@/components/ui";
import { CubeIcon } from "@/components/icons";

/** 3D model state as admins think about it (READY with no model can't happen; FAILED may still have an older model). */
export function ModelStatusBadge({ status, hasModel }: { status: string; hasModel: boolean }) {
  if (status === "PROCESSING") {
    return (
      <Badge tone="blue">
        <Spinner className="h-3 w-3 border-[1.5px]" /> Generating
      </Badge>
    );
  }
  if (status === "FAILED") return <Badge tone="red">{hasModel ? "Last update failed" : "3D failed"}</Badge>;
  if (hasModel) {
    return (
      <Badge tone="green">
        <CubeIcon size={12} /> 3D ready
      </Badge>
    );
  }
  return <Badge>No 3D</Badge>;
}
