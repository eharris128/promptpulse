'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Copy, Terminal, Clock, BarChart3 } from 'lucide-react'

interface Step {
  number: number
  title: string
  description: string
  command?: string
  completed?: boolean
}

export function EmptyState() {
  const [copiedStep, setCopiedStep] = useState<number | null>(null)

  const steps: Step[] = [
    {
      number: 1,
      title: 'Install PromptPulse CLI',
      description: 'Install the CLI tool globally via npm',
      command: 'npm install -g promptpulse'
    },
    {
      number: 2,
      title: 'Set up automatic collection',
      description: 'Configure automatic usage data collection every 15 minutes',
      command: 'promptpulse setup'
    },
    {
      number: 3,
      title: 'Collect initial data',
      description: 'Run your first collection to populate the dashboard',
      command: 'promptpulse collect'
    }
  ]

  const handleCopy = async (command: string, stepNumber: number) => {
    try {
      await navigator.clipboard.writeText(command)
      setCopiedStep(stepNumber)
      setTimeout(() => setCopiedStep(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold">Get started with PromptPulse</h2>
        <p className="text-muted-foreground">
          Track your Claude Code usage and costs in just a few steps
        </p>
      </div>

      <div className="grid gap-4">
        {steps.map((step) => (
          <Card key={step.number} className="relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
            <CardHeader className="pb-3">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-lg font-semibold text-primary">{step.number}</span>
                </div>
                <div className="flex-1">
                  <CardTitle className="text-lg">{step.title}</CardTitle>
                  <CardDescription>{step.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            {step.command && (
              <CardContent>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted px-3 py-2 rounded-md font-mono text-sm">
                    {step.command}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(step.command!, step.number)}
                    className="flex items-center gap-2"
                  >
                    {copiedStep === step.number ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            What you&apos;ll see after setup
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Terminal className="h-4 w-4 text-muted-foreground" />
                Usage Analytics
              </div>
              <p className="text-sm text-muted-foreground">
                Track tokens, costs, and model usage across all your projects
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Session History
              </div>
              <p className="text-sm text-muted-foreground">
                View detailed session blocks and activity patterns
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                Cost Insights
              </div>
              <p className="text-sm text-muted-foreground">
                Compare your usage against Claude subscription plans
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="text-center text-sm text-muted-foreground">
        <p>Need help? Check out the <a href="https://www.docs.promptpulse.dev" className="underline">documentation</a></p>
      </div>
    </div>
  )
}