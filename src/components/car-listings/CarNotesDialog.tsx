import { useEffect, useMemo, useState } from "react"
import { Copy, Edit3, FileText, X } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkBreaks from "remark-breaks"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { PriceChangeCarCard } from "@/api/priceChangedCars"
import { useSaveCarNotes } from "@/hooks/useCarNotes"
import { CarListingCard } from "./CarListingCard"

type Props = {
  car: PriceChangeCarCard
  open: boolean
  onOpenChange: (open: boolean) => void
}

const currentMonthYear = new Date().toLocaleString("en-US", {
  month: "long",
  year: "numeric",
});


const aiPromptTemplate = (car: PriceChangeCarCard) =>
    `# ROLE

You are an expert automotive analyst, used-car market researcher, mechanical inspector, depreciation analyst, and negotiation consultant.

Your task is to perform a COMPLETE investment-grade analysis of a used car listing from Cars24, Spinny, or any similar marketplace.

Do NOT simply summarize the listing.

Instead, use the listing together with your knowledge of the current used-car market as of TODAY (${currentMonthYear}) to estimate market value, ownership costs, depreciation, resale potential, and buying risk.

Assume the buyer:

- lives in Bangalore, India
- will drive approximately 10,000 km per year
- plans to KEEP the vehicle for exactly 3 years
- intends to RESELL the vehicle after 3 years
- wants the best financial decision rather than emotional buying

Whenever possible, use today's market conditions instead of relying only on the listing.

If exact information is unavailable, clearly state that it is an estimate and explain the reasoning.

---

# Vehicle Information

- Make: ${car.brand}
- Model: ${car.carName}
- Variant: ${car.variant || "N/A"}
- Manufacturing Year: ${car.modelYear ?? "N/A"}
- Registration Year: ${car.modelYear ?? "Unknown"}
- Odometer: ${car.kmDriven != null ? `${car.kmDriven} km` : "Unknown"}
- Price: ₹${car.price.toLocaleString("en-IN")}
- Location: ${car.location ?? "Unknown"}
- Source: ${car.source}
- Previous Price Change:
₹${car.priceChange.toLocaleString("en-IN")}
since ${car.previousPriceDate ?? "first seen"}

${car.notes ? `Additional Notes:\n${car.notes}` : ""}

---

# Listing Content

Paste the complete listing below.


---

# REQUIRED ANALYSIS

Perform ALL of the following.

Do not skip any section.

---

# 1. Executive Summary

Provide a concise summary containing:

- Is this a BUY, NEGOTIATE or AVOID?
- Biggest strengths
- Biggest weaknesses
- Who should buy this vehicle
- Who should avoid this vehicle

---

# 2. Vehicle Identity Verification

Verify:

- Variant correctness
- Engine type
- Transmission
- Fuel type
- Expected feature list
- Missing features
- Whether the listing appears internally consistent

Point out anything suspicious.

---

# 3. Current Market Value (Today's Market)

Estimate today's fair market value using current market knowledge.

Include:

Average private seller price

Average dealer price

Cars24 equivalent

Spinny equivalent

Expected negotiation price

Instant resale value

Trade-in value

Expected liquidation value

Output:

| Price Type | Estimated Value |
|------------|----------------|

Then conclude whether this listing is:

- Underpriced
- Fairly priced
- Slightly overpriced
- Heavily overpriced

State approximately how much.

---

# 4. Price History Analysis

Analyze:

- Previous price changes
- Whether the seller appears motivated
- Whether waiting could reduce price further
- Whether this is likely the pricing floor

---

# 5. Depreciation Forecast (3-Year Ownership)

This is VERY IMPORTANT.

Estimate:

Purchase today

Expected resale after 1 year

Expected resale after 2 years

Expected resale after 3 years

Expected depreciation %

Expected depreciation amount

Estimated odometer after 3 years

Expected market demand after 3 years

Likelihood of quick resale

Expected resale time

Output as a table.

---

# 6. Ownership Cost Forecast (3 Years)

Estimate:

Fuel cost

Insurance

Periodic service

Tyres

Battery

Brake pads

Unexpected repairs

Wear items

Road tax implications

Expected total maintenance

Expected total ownership cost

Expected cost per kilometre

Provide assumptions.

---

# 7. Mechanical Risk Assessment

Based on:

Age

Mileage

Variant

Engine

Transmission

Brand reliability

Known issues

Expected wear

Evaluate:

Engine risk

Transmission risk

Suspension

Electrical

AC

Turbo (if applicable)

CVT/DCT/AMT risk

Cooling system

Steering

Brakes

Rate each:

Low

Medium

High

---

# 8. Known Reliability Issues

List known issues for THIS exact model and variant.

Include:

Common failures

Engine issues

Gearbox issues

Electrical issues

Interior wear

Paint issues

Suspension issues

Rust issues

Typical repair costs

Probability of occurrence

---

# 9. Service & Inspection Checklist

Recommend what MUST be inspected before buying.

Prioritize by importance.

Include:

OBD scan

Turbo health

CVT health

Engine mounts

Suspension

Accident repairs

Paint thickness

Flood damage

Tyres

Battery

AC

Steering

Brake discs

Suspension bushings

---

# 10. Listing Quality Analysis

Analyze the listing itself.

Evaluate:

Inspection quality

Missing information

Insurance quality

Number of owners

Service history

Warranty

Inspection credibility

Missing photographs

Possible hidden risks

Confidence in listing

---

# 11. Feature Value Analysis

Evaluate every important feature.

Examples:

Wireless CarPlay

Wired CarPlay

Cruise control

6 airbags

Reverse camera

360 camera

TPMS

ESC

Hill Hold

LED headlights

Sunroof

Push start

Keyless entry

Automatic climate control

Rate whether each feature increases resale value.

---

# 12. Bangalore Ownership Analysis

Specifically evaluate:

Traffic suitability

Fuel economy

Parking ease

Ground clearance

Road conditions

Flood resistance

Service network

Spare parts

Insurance availability

Popularity in Bangalore

---

# 13. Competitor Comparison

Compare this vehicle with similar alternatives currently available in the same approximate budget.

Include at least:

- Nissan Magnite
- Tata Punch
- Tata Altroz
- Hyundai Venue
- Maruti Baleno
- Maruti Fronx
- Renault Kiger (other variants if applicable)
- Honda Jazz (used)
- Hyundai i20
- Toyota Glanza

For each compare:

Price

Reliability

Features

Safety

Running cost

Resale

Depreciation

Overall value

Highlight whether buying this car is still the best decision.

---

# 14. Negotiation Strategy

Estimate:

Ideal offer price

Maximum price worth paying

Walk-away price

Negotiation leverage points

Questions to ask seller

Likely dealer margin

Probability dealer accepts negotiation

---

# 15. Investment Score

Score every category:

Price Value (/10)

Mechanical Health (/10)

Reliability (/10)

Depreciation (/10)

Resale Potential (/10)

Maintenance Cost (/10)

Fuel Economy (/10)

Features (/10)

Safety (/10)

Market Demand (/10)

Negotiation Opportunity (/10)

Listing Transparency (/10)

Future Value (/10)

Ownership Experience (/10)

Overall Investment (/10)

Show as a markdown table.

---

# 16. Final Verdict

Include:

✅ Overall Score: X.X / 10

⭐ Deal Rating

Excellent Buy

Very Good

Good

Average

Poor

Avoid

Would you personally recommend buying this car today?

YES / NO / ONLY IF NEGOTIATED

---

# 17. Pros & Cons

## Biggest Advantages

- ...

## Biggest Risks

- ...

---

# 18. Bottom Line

In one paragraph answer:

"If this were your own money, would you buy this car today and keep it for 3 years before reselling?"

Explain using:

- today's market
- depreciation
- resale
- ownership cost
- negotiation potential
- expected ROI
- overall financial wisdom

---

# RULES

- Use today's market knowledge whenever possible.
- Do NOT simply repeat the listing.
- Clearly distinguish facts from estimates.
- State assumptions.
- Use markdown tables wherever useful.
- Be critical.
- Mention uncertainty when appropriate.
- Optimize recommendations for maximum financial return after selling in 3 years.
- Penalize poor resale, expensive maintenance, weak reliability, and overpriced listings.
- Reward strong resale, low depreciation, low maintenance, and market demand.
- End with a single sentence stating whether this is an investment-grade purchase.`


export function CarNotesDialog({ car, open, onOpenChange }: Props) {
  const [draftNotes, setDraftNotes] = useState(car.notes ?? "")
  const [isEditing, setIsEditing] = useState(!car.notes)
  const saveNotesMutation = useSaveCarNotes()

  useEffect(() => {
    if (open) {
      setDraftNotes(car.notes ?? "")
      setIsEditing(!car.notes)
    }
  }, [car.notes, open])

  const prompt = useMemo(() => aiPromptTemplate(car), [car])
  const hasNotes = Boolean(car.notes?.trim())

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        showCloseButton={false} 
        className="flex max-h-[90vh] w-[95vw] flex-col gap-0 p-0 sm:max-w-[50vw]"
      >
        <DialogHeader className="border-b border-border p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <DialogTitle className="text-left">{car.brand} {car.carName}</DialogTitle>
              <DialogDescription className="mt-1 text-left">
                Notes and AI prompt for this listing.
              </DialogDescription>
            </div>
            <DialogClose>
              <button
                type="button"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <X className="h-4 w-4" />
              </button>
            </DialogClose>
          </div>
        </DialogHeader>

        <div className="flex-1 space-y-8 overflow-y-auto p-6">
            <CarListingCard car={car} />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-foreground" htmlFor={`notes-${car.id}`}>
                AI Analysis
              </label>
              {!isEditing && hasNotes && (
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  className="h-8 text-muted-foreground hover:text-foreground"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit3 className="mr-1.5 h-3.5 w-3.5" />
                  Edit
                </Button>
              )}
            </div>

            {isEditing ? (
              <div className="flex flex-col gap-3 transition-all">
                <textarea
                  id={`notes-${car.id}`}
                  value={draftNotes}
                  onChange={(event) => setDraftNotes(event.target.value)}
                  placeholder="Add markdown notes here..."
                  className="min-h-[260px] w-full resize-y rounded-xl border border-input bg-background px-4 py-3 text-sm leading-relaxed shadow-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      saveNotesMutation.mutate({ carId: car.id, notes: draftNotes.trim() || null })
                      setIsEditing(false)
                    }}
                    disabled={saveNotesMutation.isPending}
                    className="w-full sm:w-auto"
                  >
                    {saveNotesMutation.isPending ? "Saving..." : "Save notes"}
                  </Button>
                  {hasNotes && (
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => {
                        setDraftNotes(car.notes ?? "")
                        setIsEditing(false)
                      }}
                      className="w-full sm:w-auto"
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              hasNotes ? (
                <div className="rounded-xl border border-border bg-muted/30 p-5 text-sm text-foreground">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm, remarkBreaks]}
                    components={{
                      h1: ({node, ...props}) => <h1 className="mt-6 mb-4 text-2xl font-bold tracking-tight first:mt-0" {...props} />,
                      h2: ({node, ...props}) => <h2 className="mt-5 mb-3 text-xl font-bold tracking-tight first:mt-0" {...props} />,
                      h3: ({node, ...props}) => <h3 className="mt-4 mb-2 text-lg font-bold tracking-tight first:mt-0" {...props} />,
                      p: ({node, ...props}) => <p className="mb-4 leading-relaxed last:mb-0" {...props} />,
                      ul: ({node, ...props}) => <ul className="mb-4 ml-5 list-outside list-disc space-y-1" {...props} />,
                      ol: ({node, ...props}) => <ol className="mb-4 ml-5 list-outside list-decimal space-y-1" {...props} />,
                      li: ({node, ...props}) => <li className="pl-1 leading-relaxed" {...props} />,
                      strong: ({node, ...props}) => <strong className="font-semibold text-foreground" {...props} />,
                      a: ({node, ...props}) => <a className="font-medium text-primary underline underline-offset-4" {...props} />,
                      blockquote: ({node, ...props}) => <blockquote className="mt-4 border-l-2 border-muted-foreground pl-4 italic" {...props} />,
                      hr: ({node, ...props}) => <hr className="my-6 border-border" {...props} />,
                    }}
                  >
                    {car.notes}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-12">
                  <p className="text-sm text-muted-foreground">No notes added yet.</p>
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                    Add Note
                  </Button>
                </div>
              )
            )}
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/40 p-4">
            <div className="flex flex-col gap-0.5">
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <FileText className="h-4 w-4" />
                AI Analysis Prompt
              </span>
              <span className="text-xs text-muted-foreground">
                Copy listing context to your clipboard.
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => navigator.clipboard.writeText(prompt)}
              className="shrink-0"
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Copy
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}