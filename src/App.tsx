import CarListings from "./pages/CarListings"
import PriceChangesPage from "./pages/PriceChangesPage"
import ScappersHome from "./pages/ScappersHome"

function normalizeRoute(pathname: string) {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "")
  const normalizedPath = pathname.replace(/\/$/, "") || "/"

  if (normalizedPath === basePath) {
    return "/"
  }

  if (normalizedPath.startsWith(basePath)) {
    return normalizedPath.slice(basePath.length) || "/"
  }

  return normalizedPath
}

function getRoute() {
  const params = new URLSearchParams(window.location.search)
  const redirectParam = params.get("redirect")
  const pathname = redirectParam || window.location.pathname

  return normalizeRoute(pathname)
}

export function App() {
  const route = getRoute()

  if (route === "/used-cars") {
    return <CarListings />
  }

  if (route === "/price-changes") {
    return <PriceChangesPage />
  }

  return <ScappersHome />
}

export default App
