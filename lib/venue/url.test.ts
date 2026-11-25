import { describe, expect, it } from "vitest";
import { asPublicHttpUrl, isPublicHttpUrl } from "./url";

describe("public venue URLs", () => {
  it("accepts public http(s) hosts", () => {
    expect(isPublicHttpUrl("https://example.com/menu")).toBe(true);
    expect(isPublicHttpUrl("http://example.com:8080/menu")).toBe(true);
    expect(isPublicHttpUrl("https://8.8.8.8/menu")).toBe(true);
    expect(isPublicHttpUrl("https://[2001:4860:4860::8888]/menu")).toBe(true);
  });

  it("rejects non-http protocols and malformed URLs", () => {
    expect(isPublicHttpUrl("ftp://example.com/menu")).toBe(false);
    expect(isPublicHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isPublicHttpUrl("not a url")).toBe(false);
  });

  it("rejects loopback, private, link-local, and reserved hosts", () => {
    const blocked = [
      "http://localhost/menu",
      "http://localhost./menu",
      "http://app.localhost/menu",
      "http://printer.local/menu",
      "http://intranet/menu",
      "http://127.0.0.1/menu",
      "http://127.10.0.1/menu",
      "http://10.0.0.5/menu",
      "http://172.16.0.1/menu",
      "http://172.31.255.254/menu",
      "http://192.168.1.20/menu",
      "http://169.254.169.254/latest/meta-data",
      "http://100.64.0.1/menu",
      "http://0.0.0.0/menu",
      "http://224.0.0.1/menu",
      "http://[::1]/menu",
      "http://[fe80::1]/menu",
      "http://[fd00::1]/menu",
      "http://[ff02::1]/menu",
      "http://2130706433/menu",
    ];
    for (const url of blocked) {
      expect(isPublicHttpUrl(url), url).toBe(false);
    }
  });

  it("bounds and preserves the original URL text", () => {
    expect(asPublicHttpUrl(" https://example.com/menu ")).toBe("https://example.com/menu");
    expect(asPublicHttpUrl("http://127.0.0.1/menu")).toBeNull();
    expect(asPublicHttpUrl(42)).toBeNull();
  });
});
