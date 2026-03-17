import React from "react"
import type { Metadata } from 'next'
import { Inter, Space_Grotesk } from 'next/font/google'

import './globals.css'
import { SettingsProvider } from "@/context/SettingsContext"
import { BillingProvider } from "@/context/BillingContext"
import { CreditsProvider } from "@/context/CreditsContext"
import { ReportsProvider } from "@/context/ReportsContext"
import { PatientProvider } from "@/context/PatientContext"
import { DiagnosisProvider } from "@/features/diagnosis/context/DiagnosisContext"
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' })

export const metadata: Metadata = {
  title: 'RapiMed - Your Medical Report Interpretation Assistant',
  description: 'Understand your medical scans and reports. RapiMed helps you interpret imaging and lab results with clear, personal explanations.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-sans antialiased`}>
        <SettingsProvider>
          <BillingProvider>
            <CreditsProvider>
              <ReportsProvider>
                <PatientProvider>
                  <DiagnosisProvider>
                    {children}
                    <Toaster />
                  </DiagnosisProvider>
                </PatientProvider>
              </ReportsProvider>
            </CreditsProvider>
          </BillingProvider>
        </SettingsProvider>
      </body>
    </html>
  )
}
