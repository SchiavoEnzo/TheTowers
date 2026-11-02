import { profileController } from '../controllers/profile.controller.js'

export default [
  { method: 'GET', path: [], handler: profileController.read },
  { method: 'PATCH', path: [], handler: profileController.update },
]
