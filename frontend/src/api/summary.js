import client from './client'

export const getSummary = () => client.get('/summary')
