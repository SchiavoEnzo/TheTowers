import { campaignsController as controller } from '../controllers/campaign.controller.js'
import { resourceRoutes } from '../utils/routes.js'

export default [
  ...resourceRoutes(controller),
  { method: 'POST', path: [':id', 'join'], handler: controller.join },
  { method: 'POST', path: [':id', 'invites'], handler: controller.invite },
  { method: 'POST', path: [':id', 'agents'], handler: controller.addAgent },
  { method: 'GET', path: [':id', 'shield'], handler: controller.shield },
  { method: 'GET', path: [':id', 'rolls'], handler: controller.rolls },
  { method: 'POST', path: [':id', 'rolls'], handler: controller.createRoll },
  { method: 'GET', path: [':id', 'combats'], handler: controller.combats },
  { method: 'POST', path: [':id', 'combats'], handler: controller.createCombat },
]
