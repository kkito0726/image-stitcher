import { v4 as uuidv4 } from "uuid";

// 利用状況 (何台のブラウザから使われているか) を把握するための匿名 ID。
// 個人とは結びつかないランダム値で、nginx のアクセスログにのみ記録される。
export const CLIENT_ID_STORAGE_KEY = "image-stitcher.client-id";
export const CLIENT_ID_HEADER = "X-Client-Id";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

/**
 * ブラウザごとの匿名 ID を返す。初回は生成して保存する。
 *
 * ストレージが使えない場合 (プライベートブラウズ等) は null を返す。
 * リクエストごとに新しい ID を送ると人数を水増ししてしまうため。
 * crypto.randomUUID() は HTTPS か localhost でしか使えないため、LAN 内の http でも動く uuid を使う。
 */
export const getClientId = (
  storage: KeyValueStorage | null,
  generate: () => string = uuidv4,
): string | null => {
  if (storage === null) return null;
  try {
    const stored = storage.getItem(CLIENT_ID_STORAGE_KEY);
    if (stored !== null && UUID_PATTERN.test(stored)) return stored;

    const created = generate();
    storage.setItem(CLIENT_ID_STORAGE_KEY, created);
    return created;
  } catch {
    return null;
  }
};

export const clientIdHeaders = (clientId: string | null): Record<string, string> =>
  clientId === null ? {} : { [CLIENT_ID_HEADER]: clientId };

const browserStorage = (): KeyValueStorage | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

export const currentClientIdHeaders = (): Record<string, string> =>
  clientIdHeaders(getClientId(browserStorage()));
