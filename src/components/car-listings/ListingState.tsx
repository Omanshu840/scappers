import { Card, CardContent } from "@/components/ui/card"

type ListingStateProps = {
  children: React.ReactNode
  tone?: "default" | "error"
}

export function ListingState({
  children,
  tone = "default",
}: ListingStateProps) {
  return (
    <Card size="sm" className="rounded-xl">
      <CardContent
        className={
          tone === "error"
            ? "p-5 text-sm text-destructive"
            : "p-5 text-sm text-muted-foreground"
        }
      >
        {children}
      </CardContent>
    </Card>
  )
}
