export function normalizeForSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^\p{L}\p{N}@.+#-]+/gu, ' ').trim().replace(/\s+/g, ' ');
}
