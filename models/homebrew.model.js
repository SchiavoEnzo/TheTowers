import { z } from 'zod'
import { obj, description, extras } from './shared.js'

export const homebrews = obj({
  ...description,
  category: z.enum(['threat', 'ability', 'ritual', 'item']),
  extras,
})
