import { asyncHandler } from "../utils/asyncHandler.js";
import { settingsRepository } from "../repositories/settings.repository.js";
import { profilesRepository } from "../repositories/profiles.repository.js";

export const settingsController = {
  get: asyncHandler(async (req, res) => {
    const [settings, profile] = await Promise.all([
      settingsRepository.get(req.supabase, req.user.id),
      profilesRepository.get(req.supabase, req.user.id),
    ]);
    res.json({ data: { settings, profile } });
  }),

  update: asyncHandler(async (req, res) => {
    const data = await settingsRepository.update(req.supabase, req.user.id, req.body);
    res.json({ data });
  }),

  updateProfile: asyncHandler(async (req, res) => {
    const data = await profilesRepository.update(req.supabase, req.user.id, req.body);
    res.json({ data });
  }),
};
