"use client";

import { useState, useMemo } from "react";
import food from "../food.json";

interface CampusMultiSelectProps {
  onCampusesChange?: (campuses: string[]) => void;
}

export default function CampusMultiSelect({
  onCampusesChange,
}: CampusMultiSelectProps) {
  const [selectedCampuses, setSelectedCampuses] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // Extract unique campuses from food.json
  const uniqueCampuses = useMemo(() => {
    const campusSet = new Set<string>();
    food.forEach((item: any) => {
      if (item.campus) {
        campusSet.add(item.campus);
      }
    });
    return Array.from(campusSet).sort();
  }, []);

  const handleCampusToggle = (campus: string) => {
    const updated = selectedCampuses.includes(campus)
      ? selectedCampuses.filter((c) => c !== campus)
      : [...selectedCampuses, campus];

    setSelectedCampuses(updated);
    onCampusesChange?.(updated);
  };

  const handleSelectAll = () => {
    if (selectedCampuses.length === uniqueCampuses.length) {
      setSelectedCampuses([]);
      onCampusesChange?.([]);
    } else {
      setSelectedCampuses([...uniqueCampuses]);
      onCampusesChange?.(uniqueCampuses);
    }
  };

  return (
    <div className="w-full">
      <label className="block mb-2 text-sm font-semibold text-zinc-900 dark:text-white">
        Select Locations
      </label>

      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-4 py-2 text-left border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white hover:border-zinc-400 dark:hover:border-zinc-500 transition"
        >
          <div className="flex justify-between items-center">
            <span>
              {selectedCampuses.length === 0
                ? "Choose locations..."
                : `${selectedCampuses.length} selected`}
            </span>
            <span className="text-xs">▼</span>
          </div>
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-700 shadow-lg z-10">
            <div className="p-2 border-b border-zinc-300 dark:border-zinc-600">
              <button
                onClick={handleSelectAll}
                className="w-full px-3 py-2 text-left text-sm text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-600 rounded transition"
              >
                {selectedCampuses.length === uniqueCampuses.length
                  ? "Deselect All"
                  : "Select All"}
              </button>
            </div>

            <div className="max-h-48 overflow-y-auto">
              {uniqueCampuses.map((campus) => (
                <label
                  key={campus}
                  className="flex items-center px-3 py-2 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-600 transition"
                >
                  <input
                    type="checkbox"
                    checked={selectedCampuses.includes(campus)}
                    onChange={() => handleCampusToggle(campus)}
                    className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 cursor-pointer"
                    style={{ accentColor: "#cc0033" }}
                  />
                  <span className="ml-3 text-sm text-zinc-900 dark:text-white capitalize">
                    {campus}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedCampuses.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedCampuses.map((campus) => (
            <div
              key={campus}
              className="flex items-center gap-1 px-3 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100 rounded-full text-sm"
            >
              <span className="capitalize">{campus}</span>
              <button
                onClick={() => handleCampusToggle(campus)}
                className="ml-1 text-red-600 dark:text-red-300 hover:text-red-800 dark:hover:text-red-100 font-bold"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
