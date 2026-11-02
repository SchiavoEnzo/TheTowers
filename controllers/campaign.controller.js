import { createRecordController } from './record.controller.js'
import * as campaigns from '../services/campaign.service.js'

export const campaignsController = {
  ...createRecordController('campaigns'),
  async join({ db, user, params, req, res }) {
    await campaigns.joinCampaign(db, user, params.id, req.body)
    return res.status(204).end()
  },
  async invite({ db, user, params, res }) {
    return res.status(201).json(await campaigns.createInvite(db, user, params.id))
  },
  async shield({ db, user, params, res }) {
    return res.json(await campaigns.getShield(db, user, params.id))
  },
  async addAgent({ db, user, params, req, res }) {
    await campaigns.addAgent(db, user, params.id, req.body)
    return res.status(204).end()
  },
  async rolls({ db, user, params, res }) {
    return res.json(await campaigns.listEvents(db, user, params.id, 'rolls'))
  },
  async combats({ db, user, params, res }) {
    return res.json(await campaigns.listEvents(db, user, params.id, 'combats'))
  },
  async createRoll({ db, user, params, req, res }) {
    return res.status(201).json(await campaigns.createRoll(db, user, params.id, req.body))
  },
  async createCombat({ db, user, params, req, res }) {
    return res.status(201).json(await campaigns.createCombat(db, user, params.id, req.body))
  },
}
