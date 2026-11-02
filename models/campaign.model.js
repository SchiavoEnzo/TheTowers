import { obj, description, timestamp, num, ids, extras, interval } from './shared.js'

export const campaigns = obj({
  ...description,
  start: timestamp,
  end: timestamp,
  dificulty: obj({
    level: num,
    'rolling-minimum-level': num,
    'rolling-level-cap': num.optional(),
  }).refine(
    (x) =>
      x['rolling-level-cap'] === undefined ||
      x['rolling-level-cap'] >= x['rolling-minimum-level'],
    'Teto abaixo do mínimo',
  ),
  users: ids,
  enemies: ids,
  allies: ids.default([]),
  locals: ids,
  dates: ids.default([]),
  extras,
}).refine(interval, 'Fim anterior ao início')
