import client from './client'

export const getExchangeRates = () => client.get('/exchange-rates')
