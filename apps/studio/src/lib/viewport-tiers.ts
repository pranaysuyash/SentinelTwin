/**
 * Single source of truth for the tablet/phone editing boundary.
 *
 * Below this width, creation and editing surfaces (site intake, the 3D/2D
 * workspace canvas) are gated in favor of a "use a bigger screen" notice.
 * Viewing surfaces (camera wall, replay, compare, report, analytics) stay
 * fully usable at any width — this is a capability gate, not a general
 * mobile-unsupported message.
 */
export const MOBILE_EDIT_BREAKPOINT_PX = 768;

export const MOBILE_EDIT_MEDIA_QUERY = `(max-width: ${MOBILE_EDIT_BREAKPOINT_PX - 1}px)`;
