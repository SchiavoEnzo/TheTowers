import { obj, optional, timestamp, interval } from './shared.js'

export const dates = obj({
  name: optional,
  desc: optional,
  start: timestamp,
  end: timestamp.optional(),
}).refine(interval, 'Fim anterior ao início')
