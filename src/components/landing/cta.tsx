import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export function CTA() {
  return (
    <section className="relative py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-primary/5 p-12 md:p-20">
          {/* Background glow */}
          <div className="absolute top-0 right-0 h-[300px] w-[300px] rounded-full bg-primary/10 blur-[100px]" />
          <div className="absolute bottom-0 left-0 h-[200px] w-[200px] rounded-full bg-primary/5 blur-[80px]" />

          <div className="relative z-10 text-center">
            <h2 className="font-display text-4xl font-bold text-foreground md:text-5xl text-balance">
              Ready to Understand Your Medical Reports?
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground leading-relaxed">
              Upload your scans and get clear, personal interpretations. RapiMed helps you make sense of your results.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 h-14 px-8 text-base gap-2 rounded-xl" asChild>
                <Link href="/signup">
                  Get Started Free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-14 px-8 text-base rounded-xl border-border/50 bg-transparent text-foreground hover:bg-secondary" asChild>
                <Link href="#how-it-works">
                  See How It Works
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
