// The prototype offers three design directions to choose from. Each has its
// own address, so a direction can be shared as a link and works without
// JavaScript. Once one is chosen, the other two and the switcher go away.
export const designs = [
  { id: 'a', name: 'Frisch und klar', path: '' },
  { id: 'b', name: 'Warm und vertraut', path: 'b/' },
  { id: 'c', name: 'Ruhig und modern', path: 'c/' },
] as const;

export type DesignId = (typeof designs)[number]['id'];

/**
 * Turns a path inside the site into a link. The site does not always sit at
 * the root of its host: the preview is served from a sub-folder.
 */
export function sitePath(
  path: string,
  base: string = import.meta.env.BASE_URL,
): string {
  return `${base.replace(/\/$/, '')}/${path}`;
}
