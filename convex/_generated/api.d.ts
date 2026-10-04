/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as channels from "../channels.js";
import type * as http from "../http.js";
import type * as messageStorage from "../messageStorage.js";
import type * as messages from "../messages.js";
import type * as polls from "../polls.js";
import type * as presence from "../presence.js";
import type * as pushNotifications from "../pushNotifications.js";
import type * as reads from "../reads.js";
import type * as roomMedia from "../roomMedia.js";
import type * as roomSettings from "../roomSettings.js";
import type * as rooms from "../rooms.js";
import type * as typing from "../typing.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  channels: typeof channels;
  http: typeof http;
  messageStorage: typeof messageStorage;
  messages: typeof messages;
  polls: typeof polls;
  presence: typeof presence;
  pushNotifications: typeof pushNotifications;
  reads: typeof reads;
  roomMedia: typeof roomMedia;
  roomSettings: typeof roomSettings;
  rooms: typeof rooms;
  typing: typeof typing;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
