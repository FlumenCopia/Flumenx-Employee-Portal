"use client";

import React, { useState, useMemo, useRef } from "react";
import { Table, Upload, Download, Search, Copy, ArrowUpDown } from "lucide-react";
import { toast } from "@/components/ToastContext";

export function CsvViewerFormatterTool() {
  const [csvText, setCsvText] = useState<string>(
    `ID,Name,Department,Role,Status\n101,Rahul Sharma,Engineering,Lead,Active\n102,Ananya Patel,Design,Senior Designer,Active\n103,Vikram Rao,Marketing,SEO Manager,Active\n104,Sneha Joshi,Operations,Operations Head,On Leave\n105,Amit Verma,Accounting,Senior Auditor,Active`
  );
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [viewMode, setViewMode] = useState<"table" | "json">("table");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // RFC4180 basic CSV parser
  const parsedData = useMemo(() => {
    if (!csvText.trim()) return { headers: [], rows: [] };
    const lines = csvText.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) return { headers: [], rows: [] };

    const parseLine = (line: string): string[] => {
      const row: string[] = [];
      let inQuotes = false;
      let cur = "";
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          inQuotes = !inQuotes;
        } else if (c === "," && !inQuotes) {
          row.push(cur.trim());
          cur = "";
        } else {
          cur += c;
        }
      }
      row.push(cur.trim());
      return row;
    };

    const headers = parseLine(lines[0]);
    const rows = lines.slice(1).map(parseLine);
    return { headers, rows };
  }, [csvText]);

  // Filtered and sorted rows
  const displayRows = useMemo(() => {
    let list = parsedData.rows;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => r.some((cell) => cell.toLowerCase().includes(q)));
    }
    if (sortCol !== null) {
      list = [...list].sort((a, b) => {
        const valA = a[sortCol] || "";
        const valB = b[sortCol] || "";
        const numA = Number(valA);
        const numB = Number(valB);
        if (!isNaN(numA) && !isNaN(numB)) {
          return sortAsc ? numA - numB : numB - numA;
        }
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      });
    }
    return list;
  }, [parsedData.rows, search, sortCol, sortAsc]);

  // Convert to JSON
  const jsonString = useMemo(() => {
    const list = parsedData.rows.map((r) => {
      const obj: Record<string, string> = {};
      parsedData.headers.forEach((h, idx) => {
        obj[h || `col_${idx}`] = r[idx] || "";
      });
      return obj;
    });
    return JSON.stringify(list, null, 2);
  }, [parsedData]);

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (typeof e.target?.result === "string") {
        setCsvText(e.target.result);
        toast.success(`Loaded ${file.name}`);
      }
    };
    reader.readAsText(file);
  };

  const handleHeaderClick = (idx: number) => {
    if (sortCol === idx) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(idx);
      setSortAsc(true);
    }
  };

  const downloadJson = () => {
    const blob = new Blob([jsonString], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `csv_export_${Date.now()}.json`;
    a.click();
    toast.success("JSON downloaded!");
  };

  const downloadCsv = () => {
    const blob = new Blob([csvText], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `data_${Date.now()}.csv`;
    a.click();
    toast.success("CSV downloaded!");
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
        }}
      />

      {/* Top Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="tool-btn-secondary"
            style={{ fontSize: "0.82rem", padding: "8px 14px" }}
          >
            <Upload size={14} />
            <span>Upload .CSV File</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode(viewMode === "table" ? "json" : "table")}
            className="tool-btn-secondary"
            style={{ fontSize: "0.82rem", padding: "8px 14px" }}
          >
            {viewMode === "table" ? "View as JSON" : "View as Table"}
          </button>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={downloadCsv}
            className="tool-btn-secondary"
            style={{ fontSize: "0.82rem", padding: "8px 12px" }}
          >
            <Download size={13} />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={downloadJson}
            className="tool-btn-primary"
            style={{ fontSize: "0.82rem", padding: "8px 12px" }}
          >
            <Download size={13} />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {viewMode === "table" ? (
        <div>
          {/* Table Search */}
          <div style={{ marginBottom: "12px", display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ position: "relative", flex: 1, maxWidth: "340px" }}>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter table rows..."
                className="tool-input"
                style={{ paddingLeft: "32px", fontSize: "0.85rem" }}
              />
              <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--tools-text-muted)" }} />
            </div>
            <span style={{ fontSize: "0.82rem", color: "var(--tools-text-muted)" }}>
              Showing {displayRows.length} of {parsedData.rows.length} rows
            </span>
          </div>

          {/* Table Container */}
          <div style={{ overflowX: "auto", border: "1px solid var(--tools-border)", borderRadius: "10px", backgroundColor: "var(--tools-surface)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.88rem" }}>
              <thead>
                <tr style={{ backgroundColor: "var(--tools-surface-subtle)", borderBottom: "2px solid var(--tools-border)" }}>
                  {parsedData.headers.map((h, i) => (
                    <th
                      key={i}
                      onClick={() => handleHeaderClick(i)}
                      style={{
                        padding: "12px 16px",
                        fontWeight: 700,
                        cursor: "pointer",
                        userSelect: "none",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span>{h}</span>
                        <ArrowUpDown size={13} style={{ color: sortCol === i ? "var(--tools-primary)" : "var(--tools-text-muted)" }} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    style={{
                      borderBottom: "1px solid var(--tools-border)",
                      backgroundColor: rIdx % 2 === 0 ? "transparent" : "var(--tools-surface-subtle)",
                    }}
                  >
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} style={{ padding: "10px 16px" }}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div>
          <pre
            style={{
              padding: "16px",
              backgroundColor: "var(--tools-surface)",
              borderRadius: "10px",
              border: "1px solid var(--tools-border)",
              fontFamily: "var(--tools-font-mono)",
              fontSize: "0.82rem",
              maxHeight: "450px",
              overflowY: "auto",
            }}
          >
            {jsonString}
          </pre>
        </div>
      )}
    </div>
  );
}
