"use client";

import { Html } from "@react-three/drei";
import type { ComponentProps } from "react";

type HtmlProps = ComponentProps<typeof Html>;

const DEFAULT_PORTAL_TARGET = typeof document !== "undefined" ? document.body : undefined;
const DEFAULT_Z_INDEX_RANGE: [number, number] = [4000, 0];

export function SceneHtml({
  portal = DEFAULT_PORTAL_TARGET,
  zIndexRange = DEFAULT_Z_INDEX_RANGE,
  ...props
}: HtmlProps) {
  return <Html portal={portal} zIndexRange={zIndexRange} {...props} />;
}
