import { Badge } from "./ui/badge";
import { getStatusClasses } from "../utils/statusColors";

/**
 * Centralised status badge.
 * Resolves `status` to the canonical color classes from statusColors.js,
 * supports dark mode, and accepts optional icon + children for label text.
 *
 * Usage:
 *   <StatusBadge status="sent" icon={<CheckCircle className="w-3 h-3" />}>Enviado</StatusBadge>
 *   <StatusBadge status="failed">Error</StatusBadge>
 */
export default function StatusBadge({ status, icon, children, className = "" }) {
  const colorClasses = getStatusClasses(status);

  return (
    <Badge className={`${colorClasses} flex items-center gap-1 ${className}`}>
      {icon}
      {children}
    </Badge>
  );
}
