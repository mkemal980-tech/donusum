import { describe, expect, it } from "vitest";
import { escapeReportText } from "../report-html";

describe("escapeReportText", () => {
  it("HTML işaretlerini ve tırnakları metne dönüştürür", () => {
    expect(escapeReportText(`<script>alert("x")</script> O'Brien & ortakları`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; O&#39;Brien &amp; ortakları"
    );
  });

  it("boş değerleri güvenli biçimde boş metne çevirir", () => {
    expect(escapeReportText(null)).toBe("");
    expect(escapeReportText(undefined)).toBe("");
  });
});
