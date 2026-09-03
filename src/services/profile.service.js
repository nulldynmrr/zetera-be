import { prisma } from "../lib/prisma.js";

// ─────────────────────────────────────────────────────────────
// UserProfile Service — Masalah 3
// Data statis per-user: nama, NIM, prodi, fakultas, universitas, kota, logo
// Dipakai ulang di semua proyek (bukan per-proyek)
// Sesuai blueprint §3.2: terpisah dari ResearchProject
// ─────────────────────────────────────────────────────────────

/**
 * Get UserProfile by userId
 */
export async function getProfile(userId) {
  return prisma.userProfile.findUnique({
    where: { userId },
  });
}

/**
 * Create or update UserProfile (upsert)
 * Dipanggil saat user menyelesaikan onboarding wizard
 */
export async function upsertProfile(userId, data) {
  const { namaLengkap, nim, programStudi, fakultas, universitas, kota, logoUrl } = data;

  return prisma.userProfile.upsert({
    where: { userId },
    create: {
      userId,
      namaLengkap,
      nim,
      programStudi,
      fakultas,
      universitas,
      kota,
      logoUrl: logoUrl || null,
    },
    update: {
      namaLengkap,
      nim,
      programStudi,
      fakultas,
      universitas,
      kota,
      logoUrl: logoUrl !== undefined ? logoUrl : undefined,
    },
  });
}

/**
 * Cek apakah user sudah menyelesaikan onboarding
 * Dipakai di frontend untuk redirect ke /onboarding jika belum
 */
export async function checkOnboardingComplete(userId) {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { id: true, namaLengkap: true, programStudi: true },
  });

  return {
    isComplete: !!profile && !!profile.namaLengkap && !!profile.programStudi,
    profile,
  };
}
