import { type ElementType } from "react"
import { Switch } from "@/core/components/ui/switch"
import { Card, CardContent } from "@/core/components/ui/card"
import { Input } from "@/core/components/ui/input"
import { Button } from "@/core/components/ui/button"
import { LayoutGrid } from "lucide-react"

export interface TemplateCategory {
  key: string
  label: string
  description: string
  template_type: string
  offset_minutes: number | null
  icon: ElementType
  color: string
  placeholders: string[]
}

interface TemplateCardProps {
  category: TemplateCategory
  subject: string
  content: string
  active: boolean
  onToggle: (checked: boolean) => void
  onSubjectChange: (value: string) => void
  onContentChange: (value: string) => void
  onBrowse: () => void
}

export function TemplateCard({
  category,
  subject,
  content,
  active,
  onToggle,
  onSubjectChange,
  onContentChange,
  onBrowse,
}: TemplateCardProps) {
  const Icon = category.icon

  return (
    <Card className="rounded-xl border border-border">
      <CardContent className="p-5 flex flex-col gap-4">
        <div className="flex justify-between items-start">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 ${category.color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-1">{category.label}</h4>
              <p className="text-xs text-muted-foreground">{category.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={active} onCheckedChange={onToggle} />
            <span className="text-xs font-medium text-muted-foreground">Active</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Subject
            </label>
            <Input
              value={subject}
              onChange={(e) => onSubjectChange(e.target.value)}
              placeholder="Enter subject line"
              className="h-10"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Message Body
            </label>
            <textarea
              value={content}
              onChange={(e) => onContentChange(e.target.value)}
              rows={3}
              placeholder="Type your message..."
              className="w-full p-3 rounded-md border border-input bg-background text-sm text-foreground resize-none outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {category.placeholders.map((p) => (
              <span
                key={p}
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground"
              >
                {`{{${p}}}`}
              </span>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onBrowse}
            className="gap-1.5 mt-1"
          >
            <LayoutGrid className="h-4 w-4" />
            Browse templates
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
