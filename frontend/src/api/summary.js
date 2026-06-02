import client from './client'

export const getSummary = (params) => client.get('/summary', { params })
