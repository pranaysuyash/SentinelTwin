"use client";

import { Html } from "@react-three/drei";
import type { ComponentProps } from "react";

type HtmlProps = ComponentProps<typeof Html>;

const DEFAULT_Z_INDEX_RANGE: [number, number] = [4000, 0];

export function SceneHtml({
  zIndexRange = DEFAULT_Z_INDEX_RANGE,
  ...props
}: HtmlProps) {
  return <Html zIndexRange={zIndexRange} {...props} />;
}
