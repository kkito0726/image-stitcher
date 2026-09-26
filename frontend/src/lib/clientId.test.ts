import { describe, expect, it, vi } from "vitest";
import { CLIENT_ID_HEADER, CLIENT_ID_STORAGE_KEY, clientIdHeaders, getClientId } from "./clientId";

const VALID_ID = "3f9a1c2e-8b4d-4e6f-9a0b-1c2d3e4f5a6b";
const NEW_ID = "0b1c2d3e-4f5a-4b6c-8d7e-8f9a0b1c2d3e";

const memoryStorage = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    data,
  };
};

describe("getClientId", () => {
  it("初回は ID を生成して保存する", () => {
    const storage = memoryStorage();

    expect(getClientId(storage, () => NEW_ID)).toBe(NEW_ID);
    expect(storage.data.get(CLIENT_ID_STORAGE_KEY)).toBe(NEW_ID);
  });

  it("既定の生成関数の ID は検証を通り、次回も再利用される", () => {
    const storage = memoryStorage();

    const first = getClientId(storage);

    expect(first).not.toBeNull();
    expect(getClientId(storage)).toBe(first);
  });

  it("保存済みの ID があれば再利用し、新たに生成しない", () => {
    const storage = memoryStorage({ [CLIENT_ID_STORAGE_KEY]: VALID_ID });
    const generate = vi.fn(() => NEW_ID);

    expect(getClientId(storage, generate)).toBe(VALID_ID);
    expect(generate).not.toHaveBeenCalled();
  });

  it("保存値が UUID 形式でなければ作り直す", () => {
    const storage = memoryStorage({ [CLIENT_ID_STORAGE_KEY]: "not-a-uuid" });

    expect(getClientId(storage, () => NEW_ID)).toBe(NEW_ID);
    expect(storage.data.get(CLIENT_ID_STORAGE_KEY)).toBe(NEW_ID);
  });

  it("ストレージが使えなければ null を返す (リクエストごとの新 ID で人数を水増ししない)", () => {
    const throwing = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("SecurityError");
      },
    };

    expect(getClientId(throwing, () => NEW_ID)).toBeNull();
    expect(getClientId(null, () => NEW_ID)).toBeNull();
  });

  it("保存に失敗したら null を返す", () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };

    expect(getClientId(storage, () => NEW_ID)).toBeNull();
  });
});

describe("clientIdHeaders", () => {
  it("ID があればヘッダーに載せる", () => {
    expect(clientIdHeaders(VALID_ID)).toEqual({ [CLIENT_ID_HEADER]: VALID_ID });
  });

  it("ID がなければヘッダーを付けない", () => {
    expect(clientIdHeaders(null)).toEqual({});
  });
});
