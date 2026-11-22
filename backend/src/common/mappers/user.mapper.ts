interface PublicUserRaw {
  id: string; email: string; fullName: string; companyName: string | null;
  role: 'ADMIN' | 'ENTERPRISE'; isActive: boolean; mustChangePassword: boolean; lastLoginAt: Date | null;
}

export function toPublicUserDto(user: PublicUserRaw) {
  return {
    id: user.id, email: user.email, fullName: user.fullName, companyName: user.companyName,
    role: user.role, isActive: user.isActive, mustChangePassword: user.mustChangePassword, lastLoginAt: user.lastLoginAt,
  };
}

export function toAdminUserDto(user: PublicUserRaw & { createdAt: Date }) {
  return { ...toPublicUserDto(user), createdAt: user.createdAt };
}
