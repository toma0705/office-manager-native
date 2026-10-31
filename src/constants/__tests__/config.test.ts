import {
  PRODUCTION_API_BASE_URL,
  resolveApiBaseUrl,
  withApiPath,
} from "../config";

describe("resolveApiBaseUrl", () => {
  it(".env の値を最優先にし、末尾の / を取る", () => {
    expect(
      resolveApiBaseUrl({
        envBaseUrl: "http://192.168.0.5:3000/api/",
        extraBaseUrl: "https://example.com/api",
        isDevelopment: true,
      })
    ).toBe("http://192.168.0.5:3000/api");
  });

  it("Release ビルドでは app.config.js の値（extra.apiBaseUrl）を使う", () => {
    expect(
      resolveApiBaseUrl({
        extraBaseUrl: "https://example.com/api",
        isDevelopment: false,
      })
    ).toBe("https://example.com/api");
  });

  it("開発中で設定がなければ、Metro を動かしている PC の 3000 番を使う", () => {
    expect(
      resolveApiBaseUrl({
        devHostUri: "192.168.0.10:8081",
        isDevelopment: true,
      })
    ).toBe("http://192.168.0.10:3000/api");
    expect(resolveApiBaseUrl({ isDevelopment: true })).toBe(
      "http://localhost:3000/api"
    );
  });

  it("本番で設定がなければ、本番の API を使う", () => {
    expect(resolveApiBaseUrl({ isDevelopment: false })).toBe(
      PRODUCTION_API_BASE_URL
    );
  });
});

describe("withApiPath", () => {
  it("先頭の / があってもなくても繋げる", () => {
    expect(withApiPath("/users/me", "https://x/api")).toBe(
      "https://x/api/users/me"
    );
    expect(withApiPath("users/me", "https://x/api")).toBe(
      "https://x/api/users/me"
    );
  });
});
