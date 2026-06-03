import client from './client'

export const getFunds = () => client.get('/funds')
export const createFund = (data) => client.post('/funds', data)
export const updateFund = (id, data) => client.put(`/funds/${id}`, data)
export const updateFundBalances = (id, data) => client.put(`/funds/${id}/balances`, data)
export const deleteFund = (id) => client.delete(`/funds/${id}`)
export const getFundProjection = (id) => client.get(`/funds/${id}/projection`)
export const updateFundProjection = (id, data) => client.put(`/funds/${id}/projection`, data)
export const getAllFundProjections = () => client.get('/funds/projections')
