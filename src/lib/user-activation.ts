/**
 * Whether the page has had a user gesture (a tap, click or key). Browsers block audio and
 * vibration before one (autoplay rules). Where `navigator.userActivation` is missing (older
 * Safari), the caller's own gesture is trusted: game sounds only follow an answer or a tap.
 */
export function hasUserActivation(
  nav: { readonly userActivation?: { readonly hasBeenActive: boolean } | undefined } | undefined = typeof navigator === "undefined" ? undefined : navigator,
): boolean {
  if (!nav) return false;
  return nav.userActivation ? nav.userActivation.hasBeenActive : true;
}
