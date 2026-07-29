import { ArrowLeft, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { splitByActive, useCarsWithPriceChanges } from "@/hooks/useCarsWithPriceChanges";
import { CarSection } from "@/components/price-changes/CarSection";
import { CarSectionSkeleton } from "@/components/price-changes/CarSectionSkeleton";

export default function PriceChangesPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useCarsWithPriceChanges();
  const { active, inactive } = splitByActive(data);

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit px-0"
          onClick={() => window.history.back()}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Price changes</h1>
        <p className="text-sm text-muted-foreground">
          Listings whose price has moved since they were first tracked.
          {isFetching && !isLoading && " Refreshing…"}
        </p>
      </header>

      {isError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Couldn't load price changes</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{error instanceof Error ? error.message : "Something went wrong."}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="space-y-10">
          <CarSectionSkeleton />
          <CarSectionSkeleton />
        </div>
      ) : (
        !isError && (
          <>
            <CarSection
              title="Active listings"
              description="Currently live listings with a price change."
              cars={active}
              emptyMessage="No active listings have changed price yet."
            />
            <CarSection
              title="Inactive listings"
              description="Delisted or sold cars that had a price change before disappearing."
              cars={inactive}
              emptyMessage="No inactive listings with a price change."
              tone="muted"
            />
          </>
        )
      )}
    </div>
  );
}