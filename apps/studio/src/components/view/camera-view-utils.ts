import type { SecurityScene } from "@/schema/security-scene";

export function formatCameraTag(name: string) {
  const match = name.match(/(\d+)/);
  return `CAM ${match ? match[0] : "01"}`;
}

export function formatTargetTypeLabel(targetType: SecurityScene["criticalZones"][number]["targetType"]) {
  switch (targetType) {
    case "person_detection":
      return "Person";
    case "face_recognition":
    case "face_identification":
      return "Face";
    case "vehicle_detection":
      return "Vehicle";
    case "license_plate":
      return "License Plate";
    case "package_detection":
      return "Package";
    case "cash_counter_activity":
      return "Cash Counter";
    case "door_entry_exit":
      return "Entry / Exit";
    case "perimeter_breach":
      return "Perimeter";
    default:
      return `${targetType}`.replace(/_/g, " ");
  }
}
