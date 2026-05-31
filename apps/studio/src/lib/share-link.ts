export type ShareLinkPayload = {
  title: string;
  text: string;
  url: string;
};

export type ShareLinkStatus = "shared" | "copied" | "unavailable";

export type ShareNavigator = {
  canShare?: (data: ShareLinkPayload) => boolean;
  share?: (data: ShareLinkPayload) => Promise<void>;
  clipboard?: {
    writeText(text: string): Promise<void>;
  } | null;
};

export async function writeClipboardText(
  text: string,
  navigatorLike?: Pick<ShareNavigator, "clipboard"> | null,
): Promise<boolean> {
  const shareNavigator = navigatorLike ?? (typeof window === "undefined" ? null : (window.navigator as unknown as ShareNavigator));
  if (!shareNavigator?.clipboard?.writeText) return false;

  try {
    await shareNavigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export async function shareLinkOrCopy(
  payload: ShareLinkPayload,
  navigatorLike?: ShareNavigator | null,
): Promise<ShareLinkStatus> {
  const shareNavigator = navigatorLike ?? (typeof window === "undefined" ? null : (window.navigator as unknown as ShareNavigator));
  if (!shareNavigator) return "unavailable";

  try {
    if (typeof shareNavigator.share === "function") {
      if (typeof shareNavigator.canShare === "function" && !shareNavigator.canShare(payload)) {
        return await writeClipboardText(payload.url, shareNavigator) ? "copied" : "unavailable";
      }

      await shareNavigator.share(payload);
      return "shared";
    }
  } catch {
    // Fall through to the clipboard fallback below.
  }

  return await writeClipboardText(payload.url, shareNavigator) ? "copied" : "unavailable";
}
