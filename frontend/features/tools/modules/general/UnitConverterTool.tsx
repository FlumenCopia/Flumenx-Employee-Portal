"use client";

import React, { useState, useMemo } from "react";
import { ArrowLeftRight, Copy } from "lucide-react";
import { toast } from "@/components/ToastContext";

type UnitCategory = "length" | "weight" | "temperature" | "area" | "volume" | "time" | "data";

interface UnitDef {
  id: string;
  name: string;
  factor: number; // relative to base
}

const unitData: Record<UnitCategory, { name: string; base: string; units: UnitDef[] }> = {
  length: {
    name: "Length",
    base: "m",
    units: [
      { id: "m", name: "Meters (m)", factor: 1 },
      { id: "km", name: "Kilometers (km)", factor: 1000 },
      { id: "cm", name: "Centimeters (cm)", factor: 0.01 },
      { id: "mm", name: "Millimeters (mm)", factor: 0.001 },
      { id: "in", name: "Inches (in)", factor: 0.0254 },
      { id: "ft", name: "Feet (ft)", factor: 0.3048 },
      { id: "yd", name: "Yards (yd)", factor: 0.9144 },
      { id: "mi", name: "Miles (mi)", factor: 1609.344 },
    ],
  },
  weight: {
    name: "Weight & Mass",
    base: "kg",
    units: [
      { id: "kg", name: "Kilograms (kg)", factor: 1 },
      { id: "g", name: "Grams (g)", factor: 0.001 },
      { id: "mg", name: "Milligrams (mg)", factor: 0.000001 },
      { id: "lb", name: "Pounds (lb)", factor: 0.45359237 },
      { id: "oz", name: "Ounces (oz)", factor: 0.02834952 },
      { id: "ton", name: "Metric Tonnes (t)", factor: 1000 },
    ],
  },
  temperature: {
    name: "Temperature",
    base: "c",
    units: [
      { id: "c", name: "Celsius (°C)", factor: 1 },
      { id: "f", name: "Fahrenheit (°F)", factor: 1 },
      { id: "k", name: "Kelvin (K)", factor: 1 },
    ],
  },
  area: {
    name: "Area",
    base: "sqm",
    units: [
      { id: "sqm", name: "Square Meters (m²)", factor: 1 },
      { id: "sqkm", name: "Square Kilometers (km²)", factor: 1000000 },
      { id: "sqft", name: "Square Feet (ft²)", factor: 0.092903 },
      { id: "acre", name: "Acres", factor: 4046.86 },
      { id: "hectare", name: "Hectares", factor: 10000 },
    ],
  },
  volume: {
    name: "Volume",
    base: "l",
    units: [
      { id: "l", name: "Liters (L)", factor: 1 },
      { id: "ml", name: "Milliliters (mL)", factor: 0.001 },
      { id: "gal", name: "US Gallons (gal)", factor: 3.78541 },
      { id: "cup", name: "US Cups", factor: 0.236588 },
      { id: "floz", name: "Fluid Ounces (fl oz)", factor: 0.0295735 },
    ],
  },
  time: {
    name: "Time",
    base: "s",
    units: [
      { id: "s", name: "Seconds (s)", factor: 1 },
      { id: "min", name: "Minutes (min)", factor: 60 },
      { id: "hr", name: "Hours (hr)", factor: 3600 },
      { id: "day", name: "Days", factor: 86400 },
      { id: "week", name: "Weeks", factor: 604800 },
      { id: "month", name: "Months (30d)", factor: 2592000 },
      { id: "year", name: "Years (365d)", factor: 31536000 },
    ],
  },
  data: {
    name: "Data Storage",
    base: "mb",
    units: [
      { id: "b", name: "Bytes (B)", factor: 0.000001 },
      { id: "kb", name: "Kilobytes (KB)", factor: 0.001 },
      { id: "mb", name: "Megabytes (MB)", factor: 1 },
      { id: "gb", name: "Gigabytes (GB)", factor: 1000 },
      { id: "tb", name: "Terabytes (TB)", factor: 1000000 },
    ],
  },
};

export function UnitConverterTool() {
  const [category, setCategory] = useState<UnitCategory>("length");
  const [fromUnit, setFromUnit] = useState("m");
  const [toUnit, setToUnit] = useState("ft");
  const [inputValue, setInputValue] = useState<number>(10);

  const currentCategoryData = unitData[category];

  const handleCategoryChange = (cat: UnitCategory) => {
    setCategory(cat);
    const units = unitData[cat].units;
    setFromUnit(units[0].id);
    setToUnit(units[1] ? units[1].id : units[0].id);
  };

  const swapUnits = () => {
    const temp = fromUnit;
    setFromUnit(toUnit);
    setToUnit(temp);
  };

  const convertedValue = useMemo(() => {
    if (isNaN(inputValue)) return 0;

    if (category === "temperature") {
      let celsius = inputValue;
      if (fromUnit === "f") celsius = ((inputValue - 32) * 5) / 9;
      if (fromUnit === "k") celsius = inputValue - 273.15;

      if (toUnit === "c") return celsius;
      if (toUnit === "f") return (celsius * 9) / 5 + 32;
      if (toUnit === "k") return celsius + 273.15;
      return celsius;
    }

    const fromFactor = currentCategoryData.units.find((u) => u.id === fromUnit)?.factor || 1;
    const toFactor = currentCategoryData.units.find((u) => u.id === toUnit)?.factor || 1;

    // Convert to base, then to target
    const baseVal = inputValue * fromFactor;
    return baseVal / toFactor;
  }, [category, fromUnit, toUnit, inputValue, currentCategoryData]);

  const copyResult = () => {
    navigator.clipboard.writeText(convertedValue.toLocaleString("en-US", { maximumFractionDigits: 6 }));
    toast.success("Result copied!");
  };

  return (
    <div>
      {/* Category Pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "20px" }}>
        {(Object.keys(unitData) as UnitCategory[]).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => handleCategoryChange(cat)}
            className={`tool-cat-pill ${category === cat ? "active" : ""}`}
            style={{ padding: "8px 14px", fontSize: "0.85rem" }}
          >
            {unitData[cat].name}
          </button>
        ))}
      </div>

      <div className="tool-two-col">
        <div className="tool-controls-panel">
          <div className="tool-field-group">
            <label className="tool-label">Amount</label>
            <input
              type="number"
              value={inputValue}
              onChange={(e) => setInputValue(Number(e.target.value))}
              className="tool-input"
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "10px", alignItems: "end" }}>
            <div className="tool-field-group">
              <label className="tool-label">From</label>
              <select value={fromUnit} onChange={(e) => setFromUnit(e.target.value)} className="tool-select">
                {currentCategoryData.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ paddingBottom: "22px" }}>
              <button
                type="button"
                onClick={swapUnits}
                className="tool-btn-secondary"
                style={{ padding: "10px", borderRadius: "8px" }}
                title="Swap units"
              >
                <ArrowLeftRight size={16} />
              </button>
            </div>

            <div className="tool-field-group">
              <label className="tool-label">To</label>
              <select value={toUnit} onChange={(e) => setToUnit(e.target.value)} className="tool-select">
                {currentCategoryData.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="tool-output-panel" style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div className="tool-output-header">
            <span className="tool-output-title">Converted Value</span>
            <button
              type="button"
              onClick={copyResult}
              style={{ background: "none", border: "none", color: "var(--tools-primary)", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}
            >
              Copy
            </button>
          </div>

          <div
            style={{
              padding: "24px",
              backgroundColor: "var(--tools-surface)",
              borderRadius: "12px",
              border: "1px solid var(--tools-border)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "0.88rem", color: "var(--tools-text-muted)", marginBottom: "8px" }}>
              {inputValue} {currentCategoryData.units.find((u) => u.id === fromUnit)?.name} =
            </div>
            <div
              style={{
                fontSize: "2.2rem",
                fontWeight: 800,
                color: "var(--tools-primary)",
                fontFamily: "var(--tools-font-mono)",
                wordBreak: "break-all",
              }}
            >
              {convertedValue.toLocaleString("en-US", { maximumFractionDigits: 6 })}
            </div>
            <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--tools-text-secondary)", marginTop: "8px" }}>
              {currentCategoryData.units.find((u) => u.id === toUnit)?.name}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
