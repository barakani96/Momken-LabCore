import type { ReactNode } from 'react';
// Isolates clinical and operational values (codes, lots, dates, quantities) as left-to-right inside Arabic text.
export function Ltr({ children }: { children: ReactNode }) { return <bdi dir="ltr">{children}</bdi>; }
