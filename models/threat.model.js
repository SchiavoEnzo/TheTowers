import { being } from './being.model.js'
import { optional, num } from './shared.js'

export const threats = being.extend({
  element: optional,
  vd: num.nonnegative().optional(),
  size: optional,
  species: optional,
})
