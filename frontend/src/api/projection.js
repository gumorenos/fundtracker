import client from './client'

export const getProjectionParams = () => client.get('/projection-params')
export const updateProjectionParams = (data) => client.put('/projection-params', data)
