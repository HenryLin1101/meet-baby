import {
  getGoogleCredentialByLineUserId,
  setLineUserEmailByLineUserId,
  setLineUserGoogleDisplayNameByLineUserId,
} from "@/lib/db/repository";
import { fetchGoogleUserProfile, refreshAccessToken } from "@/lib/google/oauth";

export async function refreshGoogleProfilesForLineUsers(
  lineUserIds: string[]
): Promise<void> {
  const unique = [...new Set(lineUserIds.map((id) => id.trim()).filter(Boolean))];
  await Promise.all(
    unique.map(async (lineUserId) => {
      try {
        const credential = await getGoogleCredentialByLineUserId(lineUserId);
        if (!credential) return;

        const { accessToken } = await refreshAccessToken(credential.refreshToken);
        const profile = await fetchGoogleUserProfile(accessToken);
        if (profile.email) {
          await setLineUserEmailByLineUserId(lineUserId, profile.email);
        }
        if (profile.name) {
          await setLineUserGoogleDisplayNameByLineUserId(lineUserId, profile.name);
        }
      } catch (error) {
        console.error("[refreshGoogleProfilesForLineUsers]", lineUserId, error);
      }
    })
  );
}
