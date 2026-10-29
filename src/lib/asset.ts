// Resolves a file in /public under the deploy base path (GitHub Pages serves the site from /my-site-/).
export function asset(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
}
