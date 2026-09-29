import { v } from "convex/values";
import { internalAction } from "./_generated/server";

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

function isValidExpoToken(token: string | undefined | null): boolean {
  return (
    typeof token === "string" &&
    token.length > 0 &&
    token.startsWith("ExponentPushToken[")
  );
}

function buildExpoMessage(params: {
  pushToken: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}) {
  return {
    to: params.pushToken,
    sound: "default",
    title: params.title,
    body: params.body,
    data: params.data ?? {},
    priority: "high",
    channelId: "default",
  };
}

export const sendPushNotification = internalAction({
  args: {
    pushToken: v.string(),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()),
  },
  handler: async (_ctx, args) => {
    if (!isValidExpoToken(args.pushToken)) {
      console.log(
        "⚠️ Пропускаємо відправку — некоректний Expo pushToken:",
        args.pushToken,
      );
      return { success: false, reason: "Invalid token" };
    }

    const message = buildExpoMessage({
      pushToken: args.pushToken,
      title: args.title,
      body: args.body,
      data: args.data,
    });

    try {
      const response = await fetch(EXPO_PUSH_ENDPOINT, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      });

      const result = await response.json();
      console.log("📨 Push send result:", JSON.stringify(result));
      return result;
    } catch (error) {
      console.error("❌ Помилка відправки push-сповіщення:", error);
      return { error: String(error) };
    }
  },
});

export const sendPushNotificationsBatch = internalAction({
  args: {
    notifications: v.array(
      v.object({
        pushToken: v.string(),
        title: v.string(),
        body: v.string(),
        data: v.optional(v.any()),
      }),
    ),
  },
  handler: async (_ctx, args) => {
    const validMessages = args.notifications
      .filter((n) => isValidExpoToken(n.pushToken))
      .map((n) =>
        buildExpoMessage({
          pushToken: n.pushToken,
          title: n.title,
          body: n.body,
          data: n.data,
        }),
      );

    if (validMessages.length === 0) {
      console.log("⚠️ Batch push: усі токени невалідні, відправка скасована");
      return { sent: 0 };
    }

    const CHUNK_SIZE = 100;
    const chunks: (typeof validMessages)[] = [];
    for (let i = 0; i < validMessages.length; i += CHUNK_SIZE) {
      chunks.push(validMessages.slice(i, i + CHUNK_SIZE));
    }

    const results: unknown[] = [];

    for (const chunk of chunks) {
      try {
        const response = await fetch(EXPO_PUSH_ENDPOINT, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Accept-Encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(chunk),
        });

        const result = await response.json();
        console.log(
          `📨 Batch push результат (${chunk.length} отримувачів):`,
          JSON.stringify(result),
        );
        results.push(result);
      } catch (error) {
        console.error("❌ Помилка пакетної відправки push-сповіщень:", error);
        results.push({ error: String(error) });
      }
    }

    return { sent: validMessages.length, batches: results.length, results };
  },
});
