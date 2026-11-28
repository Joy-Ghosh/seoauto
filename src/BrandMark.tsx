import React from "react";

/** One asset for the browser tab and product identity at every size. */
export default function BrandMark({ size = 32 }: { size?: number }) {
  return <img src="/favicon.svg" alt="" aria-hidden="true" width={size} height={size} style={{ display: "block", flexShrink: 0 }} />;
}
