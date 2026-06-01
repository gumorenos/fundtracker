import client from './client'

export const login = (username, password) =>
  client.post('/auth/login', { username, password })
