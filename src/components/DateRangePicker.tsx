import * as React from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface DateRange {
  from?: Date
  to?: Date
}

interface DateRangePickerProps {
  dateRange?: DateRange
  onDateRangeChange?: (dateRange: DateRange) => void
  placeholder?: string
  className?: string
}

export function DateRangePicker({
  dateRange,
  onDateRangeChange,
  placeholder = "Selecione o período",
  className
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [startDate, setStartDate] = React.useState<string>(
    dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : ""
  )
  const [endDate, setEndDate] = React.useState<string>(
    dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : ""
  )

  // Sincronizar estados internos com mudanças no dateRange
  React.useEffect(() => {
    setStartDate(dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : "")
    setEndDate(dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : "")
  }, [dateRange])

  const handleApply = () => {
    const from = startDate ? new Date(startDate + 'T00:00:00') : undefined
    const to = endDate ? new Date(endDate + 'T00:00:00') : undefined
    
    onDateRangeChange?.({
      from,
      to
    })
    setIsOpen(false)
  }

  const handleClear = () => {
    setStartDate("")
    setEndDate("")
    onDateRangeChange?.({ from: undefined, to: undefined })
    setIsOpen(false)
  }

  const displayText = React.useMemo(() => {
    if (dateRange?.from && dateRange?.to) {
      return `${format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })} - ${format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}`
    }
    if (dateRange?.from) {
      return format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
    }
    return placeholder
  }, [dateRange, placeholder])

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-64 font-normal transition-all duration-300",
              "bg-gradient-hero backdrop-blur-sm border-border/50",
              "hover:bg-secondary/80 hover:shadow-glow-soft hover:scale-[1.02]",
              dateRange?.from || dateRange?.to 
                ? "justify-start text-left" 
                : "justify-center text-center",
              !dateRange?.from && !dateRange?.to && "text-muted-foreground"
            )}
          >
            <CalendarIcon className={cn(
              "h-4 w-4",
              dateRange?.from || dateRange?.to ? "mr-2" : "mr-2"
            )} />
            {displayText}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-4 bg-card/95 backdrop-blur-md border-border/50" align="start">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Data Inicial</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">Data Final</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleApply}
                className="flex-1"
                size="sm"
              >
                Aplicar
              </Button>
              <Button
                onClick={handleClear}
                variant="outline"
                className="flex-1"
                size="sm"
              >
                Limpar
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
