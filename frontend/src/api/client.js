import axios from 'axios'

// In production: use the Railway backend URL directly
// In dev: proxy via Vite (/api → localhost:8000)
const baseURL = import.meta.env.VITE_API_URL
  || (import.meta.env.PROD ? 'https://backend-production-c8d3.up.railway.app' : '/api')

const api = axios.create({ baseURL })

export const getStats = () => api.get('/stats/')
export const getProducts = (skip = 0, limit = 200) =>
  api.get('/products/', { params: { skip, limit } })
export const getProductPrices = (name) =>
  api.get(`/products/${encodeURIComponent(name)}/prices`)
export const getMarkets = () => api.get('/markets/')
export const getReceipts = (limit = 10) =>
  api.get('/receipts/', { params: { limit } })
export const uploadReceipt = (file) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post('/receipts/upload', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
