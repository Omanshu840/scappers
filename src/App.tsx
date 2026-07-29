import CarListings from "./pages/CarListings"
import PriceChangesPage from "./pages/PriceChangesPage"
import ScappersHome from "./pages/ScappersHome"
import { useLinkInterceptor, useRoute } from "./lib/router"

export function App() {
  const route = useRoute()
  useLinkInterceptor()

  if (route === "/used-cars") {
    return <CarListings />
  }

  if (route === "/price-changes") {
    return <PriceChangesPage />
  }

  return <ScappersHome />
}

export default App