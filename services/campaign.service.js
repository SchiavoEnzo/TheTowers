import { randomInt } from 'node:crypto'
import { z } from 'zod'
import { combat, joinedAgent, roll } from '../models/event.model.js'
import { fail } from '../utils/errors.js'
import { digest, token } from '../utils/crypto.js'
import { member, newId, visible } from '../utils/records.js'
import { validateRefs } from '../utils/references.js'

async function getCampaign(db, user, campaignId) {
  const campaign = await db.collection('records').findOne({
    _id: campaignId, kind: 'campaigns', ...member(user),
  })
  if (!campaign) fail(404, 'Campanha indisponível')
  return campaign
}

export async function joinCampaign(db, user, campaignId, input) {
  const code = z.string().regex(/^[a-f0-9]{64}$/).parse(input?.code)
  const result = await db.collection('records').updateOne(
    {
      _id: campaignId, kind: 'campaigns',
      inviteHash: digest(code), inviteExpires: { $gt: new Date() },
    },
    { $addToSet: { members: user } },
  )
  if (!result.matchedCount) fail(404, 'Convite inválido ou expirado')
}

export async function createInvite(db, user, campaignId) {
  const campaign = await getCampaign(db, user, campaignId)
  if (campaign.owner !== user) fail(403, 'Apenas o mestre pode convidar')
  const code = token()
  const expires = new Date(Date.now() + 86400000)
  await db.collection('records').updateOne(
    { _id: campaignId, kind: 'campaigns' },
    { $set: { inviteHash: digest(code), inviteExpires: expires } },
  )
  return { code, expires, campaign: campaignId }
}

export async function getShield(db, user, campaignId) {
  const campaign = await getCampaign(db, user, campaignId)
  if (campaign.owner !== user) fail(403, 'Apenas o mestre pode consultar o escudo')
  const records = db.collection('records')
  const events = db.collection('events')
  const [agents, rolls, combats] = await Promise.all([
    records.find({ kind: 'agents', _id: { $in: campaign.data.users } }).toArray(),
    events.find({ campaign: campaignId, type: 'rolls' }).sort({ _id: -1 }).limit(30).toArray(),
    events.find({ campaign: campaignId, type: 'combats' }).sort({ _id: -1 }).limit(10).toArray(),
  ])
  return { campaign: visible(campaign), agents, rolls, combats }
}

export async function addAgent(db, user, campaignId, input) {
  await getCampaign(db, user, campaignId)
  const { agent } = joinedAgent.parse(input)
  const records = db.collection('records')
  await db.client.withSession((session) => session.withTransaction(async () => {
    await validateRefs(
      records, 'campaigns',
      { users: [agent], enemies: [], allies: [], locals: [], dates: [] },
      user, null, session,
    )
    await records.updateOne(
      { _id: campaignId, kind: 'campaigns', ...member(user) },
      { $addToSet: { 'data.users': agent } },
      { session },
    )
  }))
}

export async function listEvents(db, user, campaignId, type) {
  await getCampaign(db, user, campaignId)
  return db.collection('events').find({ campaign: campaignId, type })
    .sort({ _id: -1 }).limit(100).toArray()
}

export async function createCombat(db, user, campaignId, input) {
  const campaign = await getCampaign(db, user, campaignId)
  if (campaign.owner !== user) fail(403, 'Apenas o mestre pode criar combates')
  const data = combat.parse(input)
  if (!data.threats.every((threat) => campaign.data.enemies.includes(threat)))
    fail(422, 'Selecione ameaças da campanha')
  const foes = await db.collection('records')
    .find({ kind: 'threats', _id: { $in: data.threats } }).toArray()
  if (foes.length !== data.threats.length) fail(409, 'Ameaça indisponível')
  const event = {
    _id: newId(), campaign: campaignId, type: 'combats', name: data.name,
    created: new Date(), threats: foes.map((threat) => ({ id: threat._id, sheet: threat.data })),
  }
  await db.collection('events').insertOne(event)
  return event
}

export async function createRoll(db, user, campaignId, input) {
  const campaign = await getCampaign(db, user, campaignId)
  const data = roll.parse(input)
  if (!campaign.data.users.includes(data.agent)) fail(422, 'Agente fora da campanha')
  const agent = await db.collection('records').findOne({ _id: data.agent, kind: 'agents' })
  if (!agent || (campaign.owner !== user && agent.owner !== user))
    fail(403, 'Sem acesso à rolagem')
  const group = data.group === 'attack' ? 'lasts' : data.group
  if (data.group === 'attack' && !['fight', 'acuracy'].includes(data.key))
    fail(422, 'Ataque usa fight ou acuracy')
  const values = agent.data.habilities[group]
  if (!Object.hasOwn(values, data.key)) fail(422, 'Habilidade inválida')
  const die = randomInt(1, 21)
  const bonus = values[data.key]
  const event = {
    _id: newId(), campaign: campaignId, type: 'rolls', ...data,
    die, bonus, total: die + bonus, by: user, created: new Date(),
  }
  await db.collection('events').insertOne(event)
  return event
}
