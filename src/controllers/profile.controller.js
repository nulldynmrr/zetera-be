import { z } from "zod";
import * as profileService from "../services/profile.service.js";

const upsertProfileSchema = z.object({
  namaLengkap: z.string().min(2, "Nama lengkap minimal 2 karakter"),
  nim: z.string().min(4, "NIM minimal 4 karakter"),
  programStudi: z.string().min(2, "Program Studi wajib diisi"),
  fakultas: z.string().min(2, "Fakultas wajib diisi"),
  universitas: z.string().min(2, "Universitas wajib diisi"),
  kota: z.string().min(2, "Kota wajib diisi"),
  logoUrl: z.string().optional().nullable(),
});

export async function getProfile(req, res, next) {
  try {
    const profile = await profileService.getProfile(req.user.sub);
    res.status(200).json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
}

export async function upsertProfile(req, res, next) {
  try {
    const validData = upsertProfileSchema.parse(req.body);
    const profile = await profileService.upsertProfile(req.user.sub, validData);
    res.status(200).json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
}

export async function checkOnboarding(req, res, next) {
  try {
    const result = await profileService.checkOnboardingComplete(req.user.sub);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}
