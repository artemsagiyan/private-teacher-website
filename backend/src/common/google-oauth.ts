export function isGoogleOAuthEnabled() {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret) return false;
  if (id === 'placeholder' || secret === 'placeholder') return false;
  return true;
}
