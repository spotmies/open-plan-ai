import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  DayPicker,
  useDayPicker,
  useNavigation,
  type CaptionProps,
  type DayPickerProps,
  type ActiveModifiers,
  type SelectSingleEventHandler,
} from "react-day-picker";
import {
  format,
  getMonth,
  getYear,
  setMonth,
  setYear,
  startOfDay,
} from "date-fns";
import type { Locale } from "date-fns";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = DayPickerProps & {
  /**
   * `dual` — Microsoft Teams–style: day grid + month/year sidebar (default).
   * `dropdown` — compact month/year `<select>`s + left/right arrows (narrow popovers).
   */
  variant?: "dual" | "dropdown";
};

/** Teams date-picker purple (approx. Fluent) */
const TEAMS_DAY_SELECTED =
  "bg-[#5B5FC7] text-white hover:bg-[#4F52B8] hover:text-white focus:bg-[#5B5FC7] focus:text-white";

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const currentYear = new Date().getFullYear();
const YEARS_BEFORE = 50;
const YEARS_AFTER = 50;
const YEARS = Array.from(
  { length: YEARS_BEFORE + YEARS_AFTER + 1 },
  (_, i) => currentYear - YEARS_BEFORE + i
);

const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function isValidDate(d: unknown): d is Date {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

/** Horizontal ↑↓ — Unicode arrows (font glyphs), not SVG “icon images” */
function HorizontalChevronPair({
  onUp,
  onDown,
  disabledUp,
  disabledDown,
  upLabel,
  downLabel,
}: {
  onUp: () => void;
  onDown: () => void;
  disabledUp?: boolean;
  disabledDown?: boolean;
  upLabel: string;
  downLabel: string;
}) {
  const arrowCls =
    "flex h-[22px] min-w-[22px] items-center justify-center font-sans text-[15px] font-normal leading-none text-muted-foreground";
  const btnCls =
    "inline-flex items-center justify-center rounded-sm p-0 transition-colors hover:bg-muted/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-25";
  return (
    <div className="inline-flex items-center gap-px">
      <button type="button" className={cn(btnCls, arrowCls)} onClick={onUp} disabled={disabledUp} aria-label={upLabel}>
        <span aria-hidden className="block -translate-y-px">
          ↑
        </span>
      </button>
      <button
        type="button"
        className={cn(btnCls, arrowCls)}
        onClick={onDown}
        disabled={disabledDown}
        aria-label={downLabel}
      >
        <span aria-hidden className="block translate-y-px">
          ↓
        </span>
      </button>
    </div>
  );
}

/** Dropdown caption: month/year selects + prev/next (stable default) */
function DropdownCaption({ displayMonth }: { displayMonth: Date }) {
  const { goToMonth, nextMonth, previousMonth } = useNavigation();
  const safeMonth = React.useMemo(
    () => (isValidDate(displayMonth) ? displayMonth : new Date()),
    [displayMonth]
  );

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) {
      goToMonth(setMonth(safeMonth, val));
    }
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) {
      goToMonth(setYear(safeMonth, val));
    }
  };

  return (
    <div className="flex items-center justify-between px-1 py-1">
      <button
        type="button"
        className={cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        )}
        onClick={() => previousMonth && goToMonth(previousMonth)}
        disabled={!previousMonth}
        aria-label="Go to previous month"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-1">
        <select
          value={getMonth(safeMonth)}
          onChange={handleMonthChange}
          className="cursor-pointer rounded-md bg-transparent px-1 py-0.5 text-sm font-medium hover:bg-accent focus:outline-none focus:ring-1 focus:ring-ring"
          aria-label="Select month"
        >
          {MONTHS_LONG.map((month, i) => (
            <option key={month} value={i} className="bg-popover text-popover-foreground">
              {month}
            </option>
          ))}
        </select>

        <select
          value={getYear(safeMonth)}
          onChange={handleYearChange}
          className="cursor-pointer rounded-md bg-transparent px-1 py-0.5 text-sm font-medium hover:bg-accent focus:outline-none focus:ring-1 focus:ring-ring"
          aria-label="Select year"
        >
          {YEARS.map((year) => (
            <option key={year} value={year} className="bg-popover text-popover-foreground">
              {year}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        className={cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        )}
        onClick={() => nextMonth && goToMonth(nextMonth)}
        disabled={!nextMonth}
        aria-label="Go to next month"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function DualCaption({ displayMonth, id }: CaptionProps) {
  const { goToMonth, nextMonth, previousMonth } = useNavigation();
  const { locale, classNames, styles } = useDayPicker();
  const safeMonth = isValidDate(displayMonth) ? displayMonth : new Date();
  const label = format(safeMonth, "MMMM yyyy", { locale });

  const stepPrev = () => previousMonth && goToMonth(previousMonth);
  const stepNext = () => nextMonth && goToMonth(nextMonth);

  return (
    <div
      className={cn(classNames.caption, "flex w-full items-center justify-between gap-2 px-0 pb-1.5 pt-0")}
      style={styles.caption}
    >
      <h2 id={id} className="min-w-0 flex-1 truncate text-left text-sm font-semibold tracking-tight">
        {label}
      </h2>
      <HorizontalChevronPair
        onUp={stepPrev}
        onDown={stepNext}
        disabledUp={!previousMonth}
        disabledDown={!nextMonth}
        upLabel="Previous month"
        downLabel="Next month"
      />
    </div>
  );
}

function DualMonthSidebar() {
  const { goToMonth, currentMonth } = useNavigation();
  const dayPicker = useDayPicker();
  const displayYear = getYear(currentMonth);
  const selectedMonthIndex = getMonth(currentMonth);
  const { fromDate, toDate, fromYear, toYear, locale, mode, onSelect } = dayPicker;

  const minYear = fromYear ?? (fromDate ? getYear(fromDate) : undefined);
  const maxYear = toYear ?? (toDate ? getYear(toDate) : undefined);

  const canYearUp = maxYear === undefined || displayYear < maxYear;
  const canYearDown = minYear === undefined || displayYear > minYear;

  const bumpYear = (delta: number) => {
    const m = getMonth(currentMonth);
    goToMonth(setMonth(setYear(currentMonth, displayYear + delta), m));
  };

  const selectMonth = (monthIndex: number) => {
    goToMonth(setMonth(setYear(currentMonth, displayYear), monthIndex));
  };

  const today = startOfDay(dayPicker.today);

  const goToToday = (e: React.MouseEvent<HTMLButtonElement>) => {
    goToMonth(today);
    if (mode === "single" && onSelect) {
      const handler = onSelect as unknown as SelectSingleEventHandler;
      handler(today, today, {} as ActiveModifiers, e);
    }
  };

  return (
    <div
      className="flex w-[130px] sm:w-[172px] shrink-0 flex-col gap-1.5 sm:gap-2 border-l border-border/80 bg-muted/20 p-1.5 sm:p-2 pl-1.5 sm:pl-2"
      aria-label="Month and year"
    >
      <div className="flex w-full items-center justify-between gap-0.5 sm:gap-1">
        <span className="min-w-0 flex-1 truncate text-left text-xs sm:text-sm font-semibold tabular-nums">
          {format(setYear(new Date(), displayYear), "yyyy", { locale })}
        </span>
        <HorizontalChevronPair
          onUp={() => canYearUp && bumpYear(1)}
          onDown={() => canYearDown && bumpYear(-1)}
          disabledUp={!canYearUp}
          disabledDown={!canYearDown}
          upLabel="Next year"
          downLabel="Previous year"
        />
      </div>

      <div className="grid grid-cols-3 gap-0.5 sm:gap-1">
        {MONTHS_SHORT.map((label, monthIndex) => {
          const isActive = monthIndex === selectedMonthIndex;
          return (
            <button
              key={label}
              type="button"
              onClick={() => selectMonth(monthIndex)}
              className={cn(
                "min-h-[26px] sm:min-h-[32px] rounded-md px-0.5 sm:px-1 py-1 sm:py-1.5 text-center text-[10px] sm:text-xs font-medium transition-colors",
                isActive
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex justify-end pt-0.5 sm:pt-1">
        <button
          type="button"
          onClick={goToToday}
          className="text-[10px] sm:text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Go to today
        </button>
      </div>
    </div>
  );
}

function DualPaneMonths({ children }: { children: React.ReactNode }) {
  const { classNames, styles } = useDayPicker();
  return (
    <div className={cn(classNames.months)} style={styles.months}>
      <div className="min-w-0 flex-1 bg-popover p-1.5 sm:p-2 pr-1 sm:pr-1.5">{children}</div>
      <DualMonthSidebar />
    </div>
  );
}

function Calendar({
  className,
  classNames,
  formatters: formattersProp,
  components: componentsProp,
  showOutsideDays = true,
  /** When `true` (default for `variant="dual"`), always show 6 week rows so height stays stable (Jan vs Feb). */
  fixedWeeks,
  variant = "dual",
  locale,
  ...rest
}: CalendarProps) {
  const dual = variant === "dual";
  const fixedWeeksResolved =
    fixedWeeks !== undefined ? fixedWeeks : dual ? true : undefined;
  // fixedWeeks requires outside days to pad to 6 rows (react-day-picker)
  const showOutsideDaysResolved =
    fixedWeeksResolved === true ? true : showOutsideDays;

  const dualFormatters = React.useMemo(
    () =>
      dual
        ? {
            formatWeekdayName: (date: Date, options?: { locale?: Locale }) =>
              format(date, "EEEEE", { locale: options?.locale ?? locale }),
          }
        : undefined,
    [dual, locale]
  );

  const mergedFormatters =
    dual && dualFormatters
      ? { ...dualFormatters, ...(formattersProp ?? {}) }
      : formattersProp;

  const mergedComponents = React.useMemo(
    () => ({
      ...(dual
        ? { Caption: DualCaption, Months: DualPaneMonths }
        : { Caption: ({ displayMonth }: CaptionProps) => <DropdownCaption displayMonth={displayMonth} /> }),
      ...componentsProp,
    }),
    [dual, componentsProp]
  );

  return (
    <DayPicker
      {...rest}
      showOutsideDays={showOutsideDaysResolved}
      fixedWeeks={fixedWeeksResolved}
      captionLayout="buttons"
      locale={locale}
      formatters={mergedFormatters}
      components={mergedComponents}
      className={cn(
        "p-0",
        !dual && "p-3",
        dual &&
          "w-max max-w-[min(560px,calc(100vw-1rem))] overflow-hidden rounded-lg border border-border/80 bg-popover text-popover-foreground shadow-md",
        className
      )}
      classNames={{
        // IMPORTANT: do not mix flex-col + flex-row — dual uses a single row via `months`
        months: dual
          ? "flex flex-row flex-nowrap items-stretch divide-x divide-border/80"
          : "flex flex-col space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0",
        month: cn("space-y-4", dual && "flex min-w-0 flex-1 flex-col space-y-2 p-0"),
        caption: dual ? "w-full pt-0" : "relative flex items-center justify-center pt-1",
        caption_label: dual ? "text-sm font-medium" : "hidden",
        nav: "flex items-center space-x-1",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse",
        head_row: "flex",
        head_cell: cn(
          "rounded-md text-[0.6rem] sm:text-[0.65rem] font-normal text-muted-foreground",
          dual ? "w-6 sm:w-7 uppercase tracking-wide" : "w-9 text-[0.8rem]"
        ),
        row: cn("flex w-full", dual ? "mt-0.5" : "mt-2"),
        cell: cn(
          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-transparent [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md [&:has([aria-selected].day-range-end)]:rounded-r-md",
          dual
            ? "h-6 w-6 sm:h-7 sm:w-7 [&:has([aria-selected])]:bg-transparent [&:has([aria-selected])]:p-0"
            : "h-9 w-9 [&:has([aria-selected])]:bg-transparent [&:has([aria-selected].day-outside)]:bg-accent/50"
        ),
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "p-0 font-normal aria-selected:opacity-100",
          dual ? "h-6 w-6 sm:h-7 sm:w-7 rounded-md sm:rounded-lg text-[11px] sm:text-xs text-foreground" : "h-9 w-9 rounded-md"
        ),
        day_range_end: "day-range-end",
        day_selected: dual
          ? cn("font-semibold shadow-sm", TEAMS_DAY_SELECTED)
          : "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
    />
  );
}

Calendar.displayName = "Calendar";

export { Calendar };
