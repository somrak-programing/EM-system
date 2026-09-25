import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");

describe("TCPR brand contract", () => {
  it("defines the official navy and teal colors", () => {
    const css = readFileSync(resolve(root, "src/app/globals.css"), "utf8");

    expect(css).toContain("#333464");
    expect(css).toContain("#00a99c");
  });

  it("uses the official logo in the header and login page", () => {
    const nav = readFileSync(resolve(root, "src/components/Nav.tsx"), "utf8");
    const login = readFileSync(resolve(root, "src/app/login/page.tsx"), "utf8");

    expect(existsSync(resolve(root, "public/tcpr-logo.png"))).toBe(true);
    expect(nav).toContain("/tcpr-logo.png");
    expect(login).toContain("/tcpr-logo.png");
  });

  it("allows public logo images through the authentication middleware", () => {
    const middleware = readFileSync(resolve(root, "src/middleware.ts"), "utf8");

    expect(middleware).toContain("png|jpg|jpeg|gif|webp|svg");
  });
});
