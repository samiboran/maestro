import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import AppWrapper from './AppWrapper'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename="/maestro">
      <AppWrapper />
    </BrowserRouter>
  </StrictMode>
)