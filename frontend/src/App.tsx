import { Provider } from 'react-redux'
// import { store } from ''

import { Router } from './core/routing/router'
import { store } from './core/store/store'

export default function App() {
  return (
    <Provider store={store}>
      <Router />
    </Provider>
  )
}
