import client from './client'

export const getAlerts = () => client.get('/alerts')
export const checkAlerts = () => client.get('/alerts/check')
export const createAlert = (data) => client.post('/alerts', data)
export const updateAlert = (id, data) => client.put(`/alerts/${id}`, data)
export const deleteAlert = (id) => client.delete(`/alerts/${id}`)
