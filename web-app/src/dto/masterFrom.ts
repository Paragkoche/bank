import { z } from "zod";

export const bodyDto = z.object({
  expenses: z.number().min(1),
  earn: z.number().min(100000),
  postcode: z.number().min(1000),
  borrow: z.number().min(1000),
});
export type bodyDtoType = z.infer<typeof bodyDto>;
