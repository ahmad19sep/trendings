export function safeReturnPath(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "/";

  const candidate = value.trim();
  if (
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    candidate.startsWith("/login")
  ) {
    return "/";
  }

  return candidate;
}

