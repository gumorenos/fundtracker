import client from './client'

export const getMyLinks = () => client.get('/auth/my-links')
export const linkPlatform = (data) => client.post('/auth/link-platform', data)
export const unlinkPlatform = (platform) => client.delete(`/auth/link-platform/${platform}`)
