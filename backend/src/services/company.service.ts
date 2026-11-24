export function companyMembership(name: string) {
  const normalized = name.trim().replace(/\s+/g, ' ');
  return {
    connectOrCreate: {
      where: { key: normalized.toLowerCase() },
      create: { name: normalized, key: normalized.toLowerCase() },
    },
  };
}
