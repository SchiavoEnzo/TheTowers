import { z } from 'zod'
import { obj, str } from './shared.js'

export const profile = obj({
  name: str.max(100).optional(),
  image: z
    .string()
    .url()
    .startsWith('https://')
    .max(2048)
    .nullable()
    .optional(),
})
