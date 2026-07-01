import { describe, expect, it } from "vitest";

import {
  isFieldRequired,
  isFieldVisible,
  validateForm,
  type FormFieldSpec,
} from "./validate-form";

describe("validateForm — required", () => {
  const fields: FormFieldSpec[] = [{ name: "email", label: "Email", fieldType: "email", required: true }];

  it("flags a missing required field", () => {
    const r = validateForm(fields, {});
    expect(r.valid).toBe(false);
    expect(r.errors.email).toContain("required");
  });

  it("passes when the required field is present + valid", () => {
    expect(validateForm(fields, { email: "a@b.com" }).valid).toBe(true);
  });

  it("does not flag an empty optional field", () => {
    expect(validateForm([{ name: "nick", label: "Nickname" }], {}).valid).toBe(true);
  });
});

describe("validateForm — type checks", () => {
  it("validates email format", () => {
    const f: FormFieldSpec[] = [{ name: "e", label: "E", fieldType: "email" }];
    expect(validateForm(f, { e: "nope" }).errors.e).toContain("valid email");
    expect(validateForm(f, { e: "a@b.co" }).valid).toBe(true);
  });

  it("validates number + min/max range", () => {
    const f: FormFieldSpec[] = [{ name: "n", label: "N", fieldType: "number", min: 1, max: 10 }];
    expect(validateForm(f, { n: "x" }).errors.n).toContain("must be a number");
    expect(validateForm(f, { n: 0 }).errors.n).toContain("at least 1");
    expect(validateForm(f, { n: 11 }).errors.n).toContain("at most 10");
    expect(validateForm(f, { n: 5 }).valid).toBe(true);
  });

  it("validates url (http/https only)", () => {
    const f: FormFieldSpec[] = [{ name: "u", label: "U", fieldType: "url" }];
    expect(validateForm(f, { u: "not a url" }).errors.u).toContain("valid URL");
    expect(validateForm(f, { u: "javascript:alert(1)" }).errors.u).toContain("valid URL");
    expect(validateForm(f, { u: "https://x.com" }).valid).toBe(true);
  });

  it("validates select/radio membership", () => {
    const f: FormFieldSpec[] = [
      { name: "s", label: "S", fieldType: "select", options: [{ label: "A", value: "a" }] },
    ];
    expect(validateForm(f, { s: "z" }).errors.s).toContain("invalid selection");
    expect(validateForm(f, { s: "a" }).valid).toBe(true);
  });

  it("validates minLength/maxLength + pattern", () => {
    const f: FormFieldSpec[] = [{ name: "t", label: "T", minLength: 2, maxLength: 4, pattern: "^[a-z]+$" }];
    expect(validateForm(f, { t: "x" }).errors.t).toContain("at least 2");
    expect(validateForm(f, { t: "xxxxx" }).errors.t).toContain("at most 4");
    expect(validateForm(f, { t: "AB" }).errors.t).toContain("expected format");
    expect(validateForm(f, { t: "ab" }).valid).toBe(true);
  });

  it("ignores an invalid regex pattern rather than blocking", () => {
    const f: FormFieldSpec[] = [{ name: "t", label: "T", pattern: "(" }];
    expect(validateForm(f, { t: "anything" }).valid).toBe(true);
  });

  it("requires a checked box when required", () => {
    const f: FormFieldSpec[] = [{ name: "agree", label: "Agree", fieldType: "checkbox", required: true }];
    expect(validateForm(f, { agree: false }).errors.agree).toContain("required");
    expect(validateForm(f, { agree: true }).valid).toBe(true);
  });
});

describe("conditional logic (FORM-02)", () => {
  const fields: FormFieldSpec[] = [
    { name: "contact", label: "Contact me", fieldType: "checkbox" },
    { name: "phone", label: "Phone", fieldType: "tel", visibleWhen: { field: "contact", equals: true }, requiredWhen: { field: "contact", equals: true } },
  ];

  it("skips a hidden field entirely (not required, not validated)", () => {
    const r = validateForm(fields, { contact: false, phone: "bad" });
    expect(r.valid).toBe(true);
  });

  it("requires + validates the field once visible", () => {
    expect(validateForm(fields, { contact: true }).errors.phone).toContain("required");
    expect(validateForm(fields, { contact: true, phone: "+1 555 123 4567" }).valid).toBe(true);
  });

  it("isFieldVisible / isFieldRequired reflect conditions", () => {
    const phone = fields[1]!;
    expect(isFieldVisible(phone, { contact: false })).toBe(false);
    expect(isFieldVisible(phone, { contact: true })).toBe(true);
    expect(isFieldRequired(phone, { contact: true })).toBe(true);
    expect(isFieldRequired(phone, { contact: false })).toBe(false);
  });
});
