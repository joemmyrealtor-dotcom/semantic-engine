import type { DataSnapshot, EntityType } from "./schema";
import { loadSnapshot, saveSnapshot, resetSnapshot } from "./db";

type EntityKey = Exclude<EntityType, never>;

type EntityMap = {
  domains: DataSnapshot["domains"][number];
  concepts: DataSnapshot["concepts"][number];
  frameworks: DataSnapshot["frameworks"][number];
  knowledgeObjects: DataSnapshot["knowledgeObjects"][number];
  clientTools: DataSnapshot["clientTools"][number];
  publications: DataSnapshot["publications"][number];
  prompts: DataSnapshot["prompts"][number];
  agents: DataSnapshot["agents"][number];
  releases: DataSnapshot["releases"][number];
};

type Listener = () => void;
const listeners = new Set<Listener>();
let cache: DataSnapshot | null = null;
let loadingPromise: Promise<DataSnapshot> | null = null;

export function subscribe(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify() { for (const l of listeners) l(); }

export async function ensureLoaded(): Promise<DataSnapshot> {
  if (cache) return cache;
  if (!loadingPromise) {
    loadingPromise = loadSnapshot().then(s => { cache = s; notify(); return s; });
  }
  return loadingPromise;
}
export function getCached(): DataSnapshot | null { return cache; }

async function mutate(fn: (s: DataSnapshot) => DataSnapshot) {
  const current = await ensureLoaded();
  const next = fn(current);
  cache = next;
  await saveSnapshot(next);
  notify();
  return next;
}

export const Repo = {
  list<K extends EntityKey>(key: K): EntityMap[K][] {
    return (cache ? (cache[key] as EntityMap[K][]) : []) as EntityMap[K][];
  },
  get<K extends EntityKey>(key: K, id: string): EntityMap[K] | undefined {
    return this.list(key).find(x => (x as { id: string }).id === id);
  },
  async create<K extends EntityKey>(key: K, item: EntityMap[K]) {
    await mutate(s => ({ ...s, [key]: [...(s[key] as EntityMap[K][]), item] }));
  },
  async update<K extends EntityKey>(key: K, id: string, patch: Partial<EntityMap[K]>) {
    await mutate(s => ({
      ...s,
      [key]: (s[key] as EntityMap[K][]).map(x =>
        (x as { id: string }).id === id
          ? ({ ...x, ...patch, updatedAt: new Date().toISOString() } as EntityMap[K])
          : x,
      ),
    }));
  },
  async remove<K extends EntityKey>(key: K, id: string) {
    await mutate(s => ({
      ...s,
      [key]: (s[key] as EntityMap[K][]).filter(x => (x as { id: string }).id !== id),
    }));
  },
  async replaceAll(snapshot: DataSnapshot) {
    cache = snapshot;
    await saveSnapshot(snapshot);
    notify();
  },
  async reset() {
    const s = await resetSnapshot();
    cache = s;
    notify();
    return s;
  },
  snapshot(): DataSnapshot | null { return cache; },
};
