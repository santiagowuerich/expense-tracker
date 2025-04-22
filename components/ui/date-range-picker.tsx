"use client"

import * as React from "react"
import {
  format,
  startOfMonth,
  endOfMonth,
  subMonths,
  addMonths,
  subDays,
  startOfDay,
  endOfDay,
  startOfYear,
  endOfYear,
  subYears,
} from "date-fns"
import { es } from "date-fns/locale"
import { Calendar as CalendarIcon } from "lucide-react"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Separator } from "@/components/ui/separator"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerWithRangeProps {
  date: DateRange | undefined
  onDateChange: (date: DateRange | undefined) => void
  className?: string
}

const datePresets = [
  {
    label: "Hoy",
    getRange: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }),
  },
  {
    label: "Últimos 7 días",
    getRange: () => ({
      from: startOfDay(subDays(new Date(), 6)),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: "Últimos 30 días",
    getRange: () => ({
      from: startOfDay(subDays(new Date(), 29)),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: "Este mes",
    getRange: () => ({
      from: startOfMonth(new Date()),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: "Mes pasado",
    getRange: () => {
      const lastMonth = subMonths(new Date(), 1);
      return {
        from: startOfMonth(lastMonth),
        to: endOfMonth(lastMonth),
      };
    },
  },
  {
      label: "Mes siguiente",
      getRange: () => {
          const nextMonth = addMonths(new Date(), 1);
          return {
              from: startOfMonth(nextMonth),
              to: endOfMonth(nextMonth),
          };
      }
  },
  {
      label: "Este año",
      getRange: () => ({
          from: startOfYear(new Date()),
          to: endOfDay(new Date()),
      }),
  },
  {
      label: "Año pasado",
      getRange: () => {
          const lastYear = subYears(new Date(), 1);
          return {
              from: startOfYear(lastYear),
              to: endOfYear(lastYear),
          };
      }
  }
];

export function DatePickerWithRange({
  date,
  onDateChange,
  className,
}: DatePickerWithRangeProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const handlePresetClick = (range: DateRange) => {
      console.log("[DatePicker] Preset Clicked. New range:", range);
      onDateChange(range);
      setIsOpen(false);
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-full sm:w-[300px] justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "d MMM yyyy", { locale: es })} -{" "}
                  {format(date.to, "d MMM yyyy", { locale: es })}
                </>
              ) : (
                format(date.from, "d MMM yyyy", { locale: es })
              )
            ) : (
              <span>Seleccionar rango de fechas</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 flex flex-col sm:flex-row" align="start">
          <div className="flex flex-col space-y-1 border-r pr-3 py-3 pl-3">
            <span className="text-sm font-medium px-2 pb-1 text-muted-foreground">Opciones rápidas</span>
              {datePresets.map((preset) => (
                <Button
                  key={preset.label}
                  variant="ghost"
                  className="justify-start text-sm h-8 px-2 font-normal"
                  onClick={() => handlePresetClick(preset.getRange())}
                >
                  {preset.label}
                </Button>
              ))}
          </div>
          <div className="pt-1">
            <Calendar
                initialFocus
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={(range) => {
                    onDateChange(range)
                }}
                numberOfMonths={2}
                locale={es}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
} 