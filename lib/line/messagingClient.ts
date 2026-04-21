import { messagingApi } from "@line/bot-sdk";

export function getChannelAccessTokenOrThrow(): string {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();
  if (!channelAccessToken) {
    throw new Error("LINE_CHANNEL_ACCESS_TOKEN 尚未設定。");
  }
  return channelAccessToken;
}

export function createMessagingClient(
  channelAccessToken = getChannelAccessTokenOrThrow()
) {
  return new messagingApi.MessagingApiClient({ channelAccessToken });
}
