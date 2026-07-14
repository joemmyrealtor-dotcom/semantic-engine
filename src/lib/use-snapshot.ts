import { useSyncExternalStore, useEffect, useState } from "react";
import { Repo, subscribe, ensureLoaded, getCached } from "./data/repository";
import type { DataSnapshot } from "./data/schema";

function getSnapshotStable(): DataSnapshot | null { return getCached(); }
function getServerSnapshot(): DataSnapshot | null { return null; }

export function useSnapshot(): DataSnapshot | null {
  const snap = useSyncExternalStore(subscribe, getSnapshotStable, getServerSnapshot);
  const [, force] = useState(0);
  useEffect(() => {
    if (!snap) ensureLoaded().then(() => force(x => x + 1));
  }, [snap]);
  return snap;
}

export { Repo };
