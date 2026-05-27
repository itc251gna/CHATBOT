export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ς/g, "σ")
    .toLowerCase()
    .replace(/ς/g, "σ")
    .replace(/μedico|μεdico/g, "medico")
    .replace(/μ[ιi]s/g, "μισ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function tokenize(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return [];
  }

  return normalized
    .split(" ")
    .filter((token) => token.length > 1 || /\d/.test(token));
}

export function createTokenSet(value) {
  return new Set(tokenize(value));
}
