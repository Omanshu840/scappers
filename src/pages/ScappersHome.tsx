import { Card, CardContent } from "@/components/ui/card"

const scappers = [
  {
    title: "Used Cars",
    description: "Compare live Cars24 and Spinny listings in one compact view.",
    href: "/used-cars",
    status: "Available",
  },
]

function withBasePath(path: string) {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "")
  return `${basePath}${path}`
}

export default function ScappersHome() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <img
            src={import.meta.env.BASE_URL + "logo.svg"}
            alt="Scappers logo"
            className="h-10 w-auto rounded-lg"
          />
          <div>
            <p className="text-sm font-medium text-muted-foreground">Scappers</p>
            <h1 className="font-heading text-3xl font-semibold tracking-tight">
              Choose a scapper
            </h1>
          </div>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          A collection of focused data views for tracking listings and market
          changes.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {scappers.map((scapper) => (
          <a
            key={scapper.href}
            href={withBasePath(scatterSafePath(scapper.href))}
            className="group block rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Card className="h-full rounded-lg py-0 shadow-sm transition group-hover:-translate-y-0.5 group-hover:ring-primary/25 group-hover:shadow-md">
              <CardContent className="flex h-full flex-col gap-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h2 className="font-heading text-lg font-semibold">
                      {scapper.title}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {scapper.description}
                    </p>
                  </div>

                  <span className="shrink-0 rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
                    {scapper.status}
                  </span>
                </div>

                <div className="mt-auto text-sm font-medium text-primary">
                  Open scapper
                </div>
              </CardContent>
            </Card>
          </a>
        ))}
      </section>
    </main>
  )
}

function scatterSafePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`
}
