// @ts-nocheck
import React, { useState, useEffect, useRef } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { getCairoTodayStr, addDaysToDateStr } from "../shared/time";

interface DateRangePickerProps {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  onChange: (start: string, end: string) => void;
  align?: "left" | "right";
  className?: string;
}

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

const WEEKDAYS_AR = ["أح", "إث", "ثل", "أر", "خم", "جم", "سب"];

export function DateRangePicker({ startDate, endDate, onChange, align = "right", className }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse current state dates or fall back to today
  const parseDate = (dStr: string) => {
    const parsed = new Date(dStr);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  };

  const startVal = parseDate(startDate);
  const endVal = parseDate(endDate);

  // Month being viewed in the calendar picker
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    return new Date(startVal.getFullYear(), startVal.getMonth(), 1);
  });

  // Selection states: null if not selecting, or the first date selected
  const [tempStart, setTempStart] = useState<string | null>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  // Close calendar popover on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setTempStart(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formatDateString = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const formatArabicFriendly = (dateStr: string) => {
    const date = parseDate(dateStr);
    const day = date.getDate();
    const month = MONTHS_AR[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };

  // Generate days array for the current active month view
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday, etc.

  // Calendar cells
  const cells: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

  // Previous month days to fill start of grid
  const prevMonthYear = month === 0 ? year - 1 : year;
  const prevMonth = month === 0 ? 11 : month - 1;
  const totalDaysInPrevMonth = new Date(prevMonthYear, prevMonth + 1, 0).getDate();

  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dayNum = totalDaysInPrevMonth - i;
    const dStr = `${prevMonthYear}-${String(prevMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    cells.push({ dateStr: dStr, dayNum, isCurrentMonth: false });
  }

  // Active month days
  for (let i = 1; i <= totalDaysInMonth; i++) {
    const dStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
    cells.push({ dateStr: dStr, dayNum: i, isCurrentMonth: true });
  }

  // Next month days to pad to a full 6 rows (42 cells)
  const nextMonthYear = month === 11 ? year + 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;
  const remainingCells = 42 - cells.length;
  for (let i = 1; i <= remainingCells; i++) {
    const dStr = `${nextMonthYear}-${String(nextMonth + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
    cells.push({ dateStr: dStr, dayNum: i, isCurrentMonth: false });
  }

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const handleDayClick = (dateStr: string) => {
    if (!tempStart) {
      // First click: set start date
      setTempStart(dateStr);
    } else {
      // Second click: set end date
      if (dateStr < tempStart) {
        // If clicked date is earlier than start date, reset start date to this one
        setTempStart(dateStr);
      } else {
        // We have a valid range
        onChange(tempStart, dateStr);
        setTempStart(null);
        setIsOpen(false);
      }
    }
  };

  const isSelected = (dateStr: string) => {
    if (tempStart) {
      return dateStr === tempStart || dateStr === hoveredDate;
    }
    return dateStr === startDate || dateStr === endDate;
  };

  const isInRange = (dateStr: string) => {
    if (tempStart) {
      const endCandidate = hoveredDate || tempStart;
      if (tempStart < endCandidate) {
        return dateStr > tempStart && dateStr < endCandidate;
      }
      return dateStr > endCandidate && dateStr < tempStart;
    }
    return dateStr > startDate && dateStr < endDate;
  };

  const isToday = (dateStr: string) => {
    return dateStr === getCairoTodayStr();
  };

  // Custom Presets
  const applyPreset = (presetName: "today" | "yesterday_today" | "last7" | "last14" | "last30" | "this_month" | "last_month") => {
    const today = getCairoTodayStr();
    let start = today;
    let end = today;

    if (presetName === "today") {
      start = today;
      end = today;
    } else if (presetName === "yesterday_today") {
      start = addDaysToDateStr(today, -1);
      end = today;
    } else if (presetName === "last7") {
      start = addDaysToDateStr(today, -6);
      end = today;
    } else if (presetName === "last14") {
      start = addDaysToDateStr(today, -13);
      end = today;
    } else if (presetName === "last30") {
      start = addDaysToDateStr(today, -29);
      end = today;
    } else if (presetName === "this_month") {
      start = today.substring(0, 8) + "01";
      end = today;
    } else if (presetName === "last_month") {
      const parts = today.split("-");
      let y = parseInt(parts[0]);
      let m = parseInt(parts[1]);
      m = m - 1;
      if (m === 0) {
        m = 12;
        y = y - 1;
      }
      const prevMonthStr = String(m).padStart(2, "0");
      start = `${y}-${prevMonthStr}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      end = `${y}-${prevMonthStr}-${String(lastDay).padStart(2, "0")}`;
    }

    onChange(start, end);
    setTempStart(null);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Trigger Button */}
      <button
        id="date-range-picker-trigger"
        onClick={() => setIsOpen(!isOpen)}
        className={className || "flex items-center gap-2 bg-[#0f0f24] hover:bg-[#122038] text-white px-3 py-1.5 rounded-xl border border-[#2a2a5c] text-xs font-semibold cursor-pointer transition-colors outline-none focus:ring-2 focus:ring-[#6366f1]"}
        dir="rtl"
      >
        <CalendarIcon className="w-4 h-4 text-[#6366f1]" />
        <span>من:</span>
        <span className="text-emerald-400 font-bold font-mono">{formatArabicFriendly(startDate)}</span>
        <span className="text-gray-500 mx-0.5">←</span>
        <span>إلى:</span>
        <span className="text-emerald-400 font-bold font-mono">{formatArabicFriendly(endDate)}</span>
      </button>

      {/* Popover */}
      {isOpen && (
        <div
          id="date-range-picker-popover"
          className={`absolute top-full mt-2 w-[520px] bg-[#0a0a1a] border border-[#2a2a5c] shadow-2xl rounded-2xl p-4 z-50 flex gap-4 ${
            align === "right" ? "right-0" : "left-0"
          }`}
          dir="rtl"
        >
          {/* Preset Options Sidebar */}
          <div className="w-[120px] border-l border-[#2a2a5c]/70 pl-3 flex flex-col gap-1.5 text-[10px]">
            <span className="text-[#a5a5c8] font-black text-[9px] mb-1.5 block">فترات سريعة</span>
            <button
              onClick={() => applyPreset("today")}
              className="text-right py-1 px-2 hover:bg-[#2a2a5c]/40 hover:text-white rounded text-gray-300 transition-colors"
            >
              اليوم
            </button>
            <button
              onClick={() => applyPreset("yesterday_today")}
              className="text-right py-1 px-2 hover:bg-[#2a2a5c]/40 hover:text-white rounded text-gray-300 transition-colors"
            >
              أمس واليوم
            </button>
            <button
              onClick={() => applyPreset("last7")}
              className="text-right py-1 px-2 hover:bg-[#2a2a5c]/40 hover:text-white rounded text-gray-300 transition-colors"
            >
              آخر 7 أيام
            </button>
            <button
              onClick={() => applyPreset("last14")}
              className="text-right py-1 px-2 hover:bg-[#2a2a5c]/40 hover:text-white rounded text-gray-300 transition-colors"
            >
              آخر 14 يوم
            </button>
            <button
              onClick={() => applyPreset("last30")}
              className="text-right py-1 px-2 hover:bg-[#2a2a5c]/40 hover:text-white rounded text-gray-300 transition-colors"
            >
              آخر 30 يوم
            </button>
            <button
              onClick={() => applyPreset("this_month")}
              className="text-right py-1 px-2 hover:bg-[#2a2a5c]/40 hover:text-white rounded text-gray-300 transition-colors border-t border-[#2a2a5c]/40 mt-1 pt-1.5"
            >
              هذا الشهر
            </button>
            <button
              onClick={() => applyPreset("last_month")}
              className="text-right py-1 px-2 hover:bg-[#2a2a5c]/40 hover:text-white rounded text-gray-300 transition-colors"
            >
              الشهر الماضي
            </button>
          </div>

          {/* Calendar Body */}
          <div className="flex-1">
            {/* Header controls */}
            <div className="flex justify-between items-center mb-3">
              <button
                onClick={handleNextMonth}
                className="p-1 hover:bg-[#2a2a5c] text-[#a5a5c8] hover:text-white rounded transition-colors"
                title="الشهر القادم"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <span className="text-xs font-black text-white">
                {MONTHS_AR[month]} {year}
              </span>
              <button
                onClick={handlePrevMonth}
                className="p-1 hover:bg-[#2a2a5c] text-[#a5a5c8] hover:text-white rounded transition-colors"
                title="الشهر السابق"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            {/* Weekdays */}
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-gray-500 mb-2">
              {WEEKDAYS_AR.map((day, idx) => (
                <div key={idx} className="py-0.5">
                  {day}
                </div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1">
              {cells.map((cell, idx) => {
                const selected = isSelected(cell.dateStr);
                const ranged = isInRange(cell.dateStr);
                const current = cell.isCurrentMonth;
                const today = isToday(cell.dateStr);

                return (
                  <button
                    key={idx}
                    onClick={() => handleDayClick(cell.dateStr)}
                    onMouseEnter={() => tempStart && setHoveredDate(cell.dateStr)}
                    className={`h-7 rounded-lg text-[10px] font-bold font-mono transition-all relative flex items-center justify-center cursor-pointer ${
                      selected
                        ? "bg-[#6366f1] text-white shadow-md z-10"
                        : ranged
                        ? "bg-[#6366f1]/20 text-white"
                        : current
                        ? "text-gray-200 hover:bg-[#2a2a5c]/60"
                        : "text-gray-600 hover:bg-[#2a2a5c]/20"
                    } ${today && !selected ? "ring-1 ring-[#E879F9]" : ""}`}
                  >
                    <span>{cell.dayNum}</span>
                    {today && (
                      <span className="absolute bottom-0.5 w-1 h-1 bg-[#E879F9] rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Helper Hint */}
            <div className="text-[9px] text-[#a5a5c8]/70 text-left mt-3">
              {tempStart ? (
                <span className="text-[#E879F9] font-bold">
                  اختر تاريخ النهاية (تحديد المدى)...
                </span>
              ) : (
                <span>اختر تاريخ البدء، ثم تاريخ الانتهاء.</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
