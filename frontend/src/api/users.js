import client from './client'

export const getMe = () => client.get('/users/me')
export const getUsers = () => client.get('/users')
export const setUserActive = (id, data) => client.put(`/users/${id}/active`, data)
export const setReadOnlyMode = (data) => client.put('/users/me/read-only-mode', data)
export const changePassword = (data) => client.put('/users/me/password', data)
export const generateInvite = () => client.post('/auth/invite')
export const generateApiToken = (data) => client.post('/auth/api-token', data)
export const registerWithInvite = (data) => client.post('/auth/register', data)
