import CarListings from "./pages/CarListings"
import ScappersHome from "./pages/ScappersHome"
import { useLinkInterceptor, useRoute } from "./lib/router"

export function App() {
  const route = useRoute()
  useLinkInterceptor()

  if (route === "/used-cars") {
    return <CarListings />
  }

  return <ScappersHome />
}

export default App