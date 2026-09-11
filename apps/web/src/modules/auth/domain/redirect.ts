/**
 * Where to land after signing in. Only a path inside this app is allowed: a
 * value that came back from a link is attacker-controlled, and `//evil.test`
 * is a protocol-relative URL that a browser reads as another origin.
 */
export function safeRedirect(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const path = value.trim();
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return undefined;
  return path;
}
