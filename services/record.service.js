import { schemas } from '../models/index.js'
import { fail } from '../utils/errors.js'
import { member, newId, visible } from '../utils/records.js'
import { validateRefs } from '../utils/references.js'
import { listQuery } from '../utils/query.js'

function accessFilter(kind, user) {
  return kind === 'campaigns' ? { kind, ...member(user) } : { kind, owner: user }
}

export async function getRecord(db, user, kind, key) {
  const records = db.collection('records')
  let document = await records.findOne({ ...accessFilter(kind, user), _id: key })
  if (
    !document && kind === 'agents' &&
    await records.findOne({ kind: 'campaigns', 'data.users': key, ...member(user) })
  ) document = await records.findOne({ kind, _id: key })
  if (!document) fail(404, 'Registro indisponível')
  return visible(document)
}

export async function listRecords(db, user, kind, query) {
  const filter = { ...accessFilter(kind, user), ...listQuery(kind, query) }
  const documents = await db.collection('records').find(filter)
    .sort({ _id: -1 }).limit(100).toArray()
  return documents.map(visible)
}

export async function saveRecord(db, user, kind, input, key) {
  const data = schemas[kind].parse(input)
  const records = db.collection('records')
  const own = { kind, owner: user }
  return db.client.withSession((session) => session.withTransaction(async () => {
    const previous = key && await records.findOne({ ...own, _id: key }, { session })
    if (key && !previous) fail(404, 'Registro indisponível')
    await validateRefs(records, kind, data, user, previous, session)
    if (key) {
      await records.updateOne({ ...own, _id: key }, { $set: { data } }, { session })
      return { _id: key, data }
    }
    const document = { _id: newId(), ...own, data }
    if (kind === 'campaigns') document.members = []
    await records.insertOne(document, { session })
    return document
  }))
}

export async function deleteRecord(db, user, kind, key) {
  const records = db.collection('records')
  const own = { kind, owner: user, _id: key }
  await db.client.withSession((session) => session.withTransaction(async () => {
    const document = await records.findOne(own, { session })
    if (!document) fail(404, 'Registro indisponível')
    const paths = [
      'users', 'allies', 'enemies', 'dates', 'locals',
      'habilities.atained-objects', 'habilities.money',
    ]
    const linked = await records.findOne(
      { $or: paths.map((path) => ({ ['data.' + path]: key })) }, { session },
    )
    if (linked) fail(409, 'Remova primeiro os vínculos deste registro')
    if (kind === 'campaigns')
      await db.collection('events').deleteMany({ campaign: key }, { session })
    await records.deleteOne(own, { session })
  }))
}
