import client from './client'

export const exportExcel = (params) =>
  client.get('/export/excel', { params, responseType: 'blob' })
