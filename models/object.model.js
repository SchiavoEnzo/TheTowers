import { obj, identity, str, num, optional } from './shared.js'

export const objects = obj({
  caractheristics: obj({ ...identity, desc: str }),
  atributes: obj({
    level: num.optional(),
    dp: num.optional(),
    sanity: num.optional(),
    pv: num.optional(),
    status: str,
    damage: obj({
      physical: num.optional(),
      mental: num.optional(),
      ethereal: num.optional(),
      type: optional,
      desc: optional,
    }).optional(),
    benefits: obj({ desc: str, status: str }),
  }),
})
