import client from './client'

export const getTransactions = (params) =>
  client.get('/transactions', { params })

export const createTransaction = (data) =>
  client.post('/transactions', data)

export const deleteTransaction = (id) =>
  client.delete(`/transactions/${id}`)
