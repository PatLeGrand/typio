import { describe, expect, it } from "vitest";
import { parseOAuthNotice } from "./oauthNotice";

describe("parseOAuthNotice", () => {
  it.each(["cancelled", "failed", "unavailable"])("accepts %s", (value) => {
    expect(parseOAuthNotice(value)).toBe(value);
  });

  it.each([undefined, "already_linked", "", "CANCELLED", "success", "<script>alert(1)</script>", "failed ", ["failed"], ["failed", "cancelled"]])(
    "ignores %j",
    (value) => {
      expect(parseOAuthNotice(value)).toBeNull();
    },
  );
});
