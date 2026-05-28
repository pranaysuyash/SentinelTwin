export function getFloorPlanExtractionConfig(state: { heightM: number; floorPlanScalePixelsPerMeter: number }) {
  return {
    roomHeightM: state.heightM,
    scalePixelsPerMeter: state.floorPlanScalePixelsPerMeter,
  };
}
