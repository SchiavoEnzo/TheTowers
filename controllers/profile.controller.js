import * as profiles from '../services/profile.service.js'

export const profileController = {
  async read({ db, user, res }) {
    return res.json(await profiles.getProfile(db, user))
  },
  async update({ db, user, req, res }) {
    return res.json(await profiles.updateProfile(db, user, req.body))
  },
}
