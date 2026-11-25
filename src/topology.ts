import type { Page } from "./types";

export function connections(pages: Page[]) {
  const aliases = new Map<string, number>();
  pages.forEach((page, index) => {
    aliases.set(page.url, index);
  });
  pages.forEach((page,index)=>{if(!aliases.has(page.finalUrl))aliases.set(page.finalUrl,index);});
  const outgoing = pages.map(() => new Set<number>());
  const incoming = pages.map(() => new Set<number>());
  pages.forEach((page, source) => {
    for (const link of page.links) {
      const target = aliases.get(link.url);
      if (target === undefined || target === source) continue;
      outgoing[source].add(target);
      incoming[target].add(source);
    }
  });
  const depths = new Map<number, number>();
  const queue = pages.length ? [0] : [];
  if (queue.length) depths.set(0, 0);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const source = queue[cursor];
    for (const target of outgoing[source]) {
      const depth=depths.get(source)!+1;
      if (!depths.has(target)||depth<depths.get(target)!) {depths.set(target,depth);queue.push(target);}
    }
    const destination=aliases.get(pages[source].finalUrl);
    if(destination!==undefined&&destination!==source){const depth=depths.get(source)!;if(!depths.has(destination)||depth<depths.get(destination)!){depths.set(destination,depth);queue.push(destination);}}
  }
  return pages.map((page, index) => ({
    page,
    incoming: incoming[index].size,
    outgoing: outgoing[index].size,
    depth: depths.get(index) ?? null,
  }));
}
