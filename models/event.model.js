import { z } from 'zod'
import { obj, str, ids, id } from './shared.js'

export const combat = obj({ name: str, threats: ids })
export const joinedAgent = obj({ agent: id })
export const roll = obj({
  agent: id,
  group: z.enum(['naturals', 'main', 'lasts', 'attack']),
  key: str.max(60),
})
