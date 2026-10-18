export function resolveLivekitUrl(configured?: string) {
  if (
    typeof window !== 'undefined' &&
    window.location.port === '3004' &&
    window.location.protocol === 'http:'
  ) {
    return `ws://${window.location.hostname}:7890`;
  }
  return configured || '';
}
