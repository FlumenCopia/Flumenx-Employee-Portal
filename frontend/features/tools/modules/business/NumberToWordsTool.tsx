"use client";

import React, { useState, useMemo } from "react";
import { Receipt, Copy, Check } from "lucide-react";
import { toast } from "@/components/ToastContext";

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
const TEENS = [
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function convertTwoDigits(num: number): string {
  if (num < 10) return ONES[num];
  if (num >= 10 && num < 20) return TEENS[num - 10];
  const ten = Math.floor(num / 10);
  const one = num % 10;
  return `${TENS[ten]}${one > 0 ? " " + ONES[one] : ""}`.trim();
}

function convertThreeDigits(num: number): string {
  const hundred = Math.floor(num / 100);
  const remainder = num % 100;
  let str = "";
  if (hundred > 0) str += `${ONES[hundred]} Hundred`;
  if (remainder > 0) {
    if (str) str += " and ";
    str += convertTwoDigits(remainder);
  }
  return str.trim();
}

// Indian System: Crores, Lakhs, Thousands, Hundreds
function numberToIndianWords(num: number): string {
  if (num === 0) return "Zero";
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const hundredPart = num;

  const parts: string[] = [];
  if (crore > 0) parts.push(`${numberToIndianWords(crore)} Crore`);
  if (lakh > 0) parts.push(`${convertTwoDigits(lakh)} Lakh`);
  if (thousand > 0) parts.push(`${convertTwoDigits(thousand)} Thousand`);
  if (hundredPart > 0) parts.push(convertThreeDigits(hundredPart));

  return parts.join(" ").trim();
}

// International System: Billions, Millions, Thousands, Hundreds
function numberToWesternWords(num: number): string {
  if (num === 0) return "Zero";
  const billion = Math.floor(num / 1000000000);
  num %= 1000000000;
  const million = Math.floor(num / 1000000);
  num %= 1000000;
  const thousand = Math.floor(num / 1000);
  const hundredPart = num % 1000;

  const parts: string[] = [];
  if (billion > 0) parts.push(`${convertThreeDigits(billion)} Billion`);
  if (million > 0) parts.push(`${convertThreeDigits(million)} Million`);
  if (thousand > 0) parts.push(`${convertThreeDigits(thousand)} Thousand`);
  if (hundredPart > 0) parts.push(convertThreeDigits(hundredPart));

  return parts.join(" ").trim();
}

export function NumberToWordsTool() {
  const [amountStr, setAmountStr] = useState<string>("148920.50");
  const [currencySystem, setCurrencySystem] = useState<"inr" | "usd">("inr");

  const wordsResult = useMemo(() => {
    const clean = amountStr.replace(/,/g, "").trim();
    const num = parseFloat(clean);
    if (isNaN(num) || num < 0) return "Please enter a valid positive number.";

    const intPart = Math.floor(num);
    const decimalPart = Math.round((num - intPart) * 100);

    if (currencySystem === "inr") {
      const rupeeWords = numberToIndianWords(intPart);
      const paiseWords = decimalPart > 0 ? convertTwoDigits(decimalPart) : "";

      let res = `${rupeeWords} Rupees`;
      if (paiseWords) res += ` and ${paiseWords} Paise`;
      res += " Only";
      return res;
    } else {
      const dollarWords = numberToWesternWords(intPart);
      const centWords = decimalPart > 0 ? convertTwoDigits(decimalPart) : "";

      let res = `${dollarWords} Dollars`;
      if (centWords) res += ` and ${centWords} Cents`;
      res += " Only";
      return res;
    }
  }, [amountStr, currencySystem]);

  const copyWords = () => {
    navigator.clipboard.writeText(wordsResult);
    toast.success("Words copied to clipboard!");
  };

  return (
    <div className="tool-two-col">
      <div className="tool-controls-panel">
        <div className="tool-field-group">
          <label className="tool-label">Enter Numeric Amount</label>
          <input
            type="text"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            placeholder="e.g. 148920.50"
            className="tool-input"
            style={{ fontSize: "1.2rem", fontFamily: "var(--tools-font-mono)", fontWeight: 700 }}
          />
          <span className="tool-help-text">Ideal for check vouchers, bank slips, and formal tax invoices.</span>
        </div>

        <div className="tool-field-group">
          <label className="tool-label">Currency & Numbering Format</label>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              onClick={() => setCurrencySystem("inr")}
              className={`tool-dept-pill ${currencySystem === "inr" ? "active" : ""}`}
              style={{ flex: 1, textAlign: "center" }}
            >
              Indian Format (₹ Lakhs / Crores)
            </button>
            <button
              type="button"
              onClick={() => setCurrencySystem("usd")}
              className={`tool-dept-pill ${currencySystem === "usd" ? "active" : ""}`}
              style={{ flex: 1, textAlign: "center" }}
            >
              International ($ Millions / Billions)
            </button>
          </div>
        </div>
      </div>

      <div className="tool-output-panel">
        <div className="tool-output-header">
          <span className="tool-output-title">Words in English</span>
          <button type="button" onClick={copyWords} className="tool-btn-primary" style={{ padding: "6px 14px", fontSize: "0.82rem" }}>
            <Copy size={13} />
            <span>Copy Text</span>
          </button>
        </div>

        <div
          style={{
            padding: "24px",
            backgroundColor: "var(--tools-surface)",
            borderRadius: "12px",
            border: "1px solid var(--tools-border)",
            fontSize: "1.25rem",
            fontWeight: 700,
            color: "var(--tools-primary)",
            lineHeight: "1.6",
            minHeight: "120px",
            display: "flex",
            alignItems: "center",
          }}
        >
          {wordsResult}
        </div>
      </div>
    </div>
  );
}
