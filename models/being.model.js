import { obj, identity, str, optional, num, numbers, skillNames, ids, extras } from './shared.js'

export const being = obj({
  caractheristics: obj({ ...identity, 'player-name': str, wishes: optional }),
  atributes: obj({
    ...numbers('level dp sanity pv shield ammo'),
    pary: num.optional(),
    dodge: num.optional(),
  }),
  habilities: obj({
    naturals: obj(numbers('inteligence wisdom existance')),
    main: obj(numbers('intelect strengh agility charisma willing')),
    lasts: obj(numbers(skillNames)),
    'atained-objects': ids.default([]),
    money: ids.default([]),
    extras,
  }),
})

