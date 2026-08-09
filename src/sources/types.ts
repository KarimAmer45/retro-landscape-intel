import { z } from "zod";

const numericField = z.coerce.number().finite().nonnegative().catch(0);
const textField = z.preprocess((value) => value ?? "", z.string());

export const steamSpyGameSchema = z.object({
  appid: z.coerce.number().int().positive(),
  name: z.string().min(1),
  developer: textField,
  publisher: textField,
  score_rank: z.union([z.string(), z.number(), z.null()]).optional(),
  positive: numericField,
  negative: numericField,
  userscore: numericField,
  owners: textField,
  average_forever: numericField,
  average_2weeks: numericField,
  median_forever: numericField,
  median_2weeks: numericField,
  price: numericField,
  initialprice: numericField,
  discount: numericField,
  ccu: numericField,
  languages: textField,
  genre: textField,
  tags: z.record(z.string(), numericField).optional().default({})
}).passthrough();

export const steamSpyPayloadSchema = z.record(z.string(), z.unknown());
export type SteamSpyGame = z.infer<typeof steamSpyGameSchema>;
