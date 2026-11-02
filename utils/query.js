import { z } from 'zod'
import { id } from '../models/shared.js'

export function listQuery(kind, input) {
  const query = {}
  if (input.q) {
    const text = z.string().max(100).parse(input.q)
    const escaped = Array.from(text)
      .map((char) => ('.*+?^${}()|[]\\'.includes(char) ? '\\' + char : char))
      .join('')
    const path = ['agents', 'beings', 'objects', 'threats'].includes(kind)
      ? 'data.caractheristics.name' : 'data.name'
    query[path] = { $regex: escaped, $options: 'i' }
  }
  if (kind === 'threats' && input.element)
    query['data.element'] = z.string().parse(input.element)
  if (kind === 'homebrews' && input.category)
    query['data.category'] = z.string().parse(input.category)
  if (input.before) query._id = { $lt: id.parse(input.before) }
  return query
}
