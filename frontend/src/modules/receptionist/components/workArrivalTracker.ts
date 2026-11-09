type WorkItem = { id: string; claim: 'AVAILABLE' | 'MINE' | 'OTHER'; status?: string; admissionStatus?: string | null };

// Compare only the same page; switching pages must not look like new work.
export function createWorkArrivalTracker() {
  const pages = new Map<string, Set<string>>();
  const allPages = new Map<string, Set<string>>();
  let count: number | null = null;
  return (cursor: string | null, items: WorkItem[], availableCount: number) => {
    const key = cursor ?? '';
    const previous = pages.get(key);
    const previousAll = allPages.get(key);
    const current = new Set(items.filter(item => item.claim === 'AVAILABLE').map(item => item.id));
    const currentAll = new Set(items.map(item => `${item.id}:${item.status ?? ''}:${item.admissionStatus ?? ''}`));
    const arrived = (previousAll !== undefined && [...currentAll].some(id => !previousAll.has(id))) || (previous !== undefined && [...current].some(id => !previous.has(id))) || (count !== null && availableCount > count);
    pages.set(key, current);
    allPages.set(key, currentAll);
    count = availableCount;
    return arrived;
  };
}
