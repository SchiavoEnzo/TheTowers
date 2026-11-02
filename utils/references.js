import { fail } from './errors.js'

function references(kind, data) {
  if (data.habilities)
    return {
      objects: data.habilities['atained-objects'],
      money: data.habilities.money,
    }
  if (kind === 'campaigns')
    return {
      agents: data.users,
      threats: data.enemies,
      beings: data.allies,
      locals: data.locals,
      dates: data.dates,
    }
  return {}
}
export async function validateRefs(records, kind, data, user, previous, session) {
  for (const [target, ids] of Object.entries(references(kind, data))) {
    for (const ref of ids) {
      const query = { _id: ref, kind: target }
      // Existing player-owned agents can stay on the roster when the GM edits the campaign.
      if (target !== 'agents' || !previous?.data.users.includes(ref))
        query.owner = user
      const result = await records.updateOne(
        query,
        { $inc: { refRevision: 1 } },
        { session },
      )
      if (!result.matchedCount)
        fail(422, 'Referência inexistente ou inacessível: ' + target)
    }
  }
}
