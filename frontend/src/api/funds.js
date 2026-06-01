import client from './client'

export const getFunds = () => client.get('/funds')
export const updateFundInitialBalance = (id, data) =>
  client.put(`/funds/${id}/initial-balance`, data)
