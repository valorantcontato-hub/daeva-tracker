// The official portrait URL can remain identical after an appearance change.
// Version each successful profile refresh so the browser requests the updated image.
export function portraitUrl(profile) {
  try {
    const url = new URL(profile.image);
    if (!['https:', 'http:'].includes(url.protocol)) return '';
    if (profile.portraitVersion || profile.fetchedAt) url.searchParams.set('_lotus', String(profile.portraitVersion || profile.fetchedAt));
    return url.href;
  } catch { return ''; }
}
