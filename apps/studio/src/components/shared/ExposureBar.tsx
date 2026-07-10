"use client";

import { motion } from "framer-motion";

interface ExposureBarProps {
  color: string;
  valuePct: number;
  animated?: boolean;
}

export function ExposureBar({ color, valuePct, animated = true }: ExposureBarProps) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full ${UI_SURFACES.hoverBg}">
      {animated ? (
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${valuePct}%` }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      ) : (
        <div
          className="h-full rounded-full"
          style={{ backgroundColor: color, width: `${valuePct}%` }}
        />
      )}
    </div>
  );
}
