import { Provider } from 'react-redux'
import { Toaster } from 'sonner'

import { Router } from './core/routing/router'
import { store } from './core/store/store'

export default function App() {
  return (
    <Provider store={store}>
      <Router />
      <Toaster position="top-right" richColors />
    </Provider>
  )
}
