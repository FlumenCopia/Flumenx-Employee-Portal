"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Table, Upload, Download, Search, Copy, ArrowUpDown, Trash2, FileText, Check } from "lucide-react";
import { toast } from "@/components/ToastContext";

const SAMPLE_CSV = `SKU,Product,Category,Price,InStock,Status
SKU-101,Ergonomic Office Chair,Furniture,249.99,45,In Stock
SKU-102,Mechanical Keyboard,Electronics,89.50,120,In Stock
SKU-103,4K Ultra HD Monitor,Electronics,399.00,18,Low Stock
SKU-104,Standing Desk Converter,Furniture,179.00,0,Out of Stock
SKU-105,Noise Canceling Headset,Audio,129.95,64,In Stock`;

export function CsvViewerFormatterTool() {
  const [csvText, setCsvText] = useState<string>("");
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [viewMode, setViewMode] = useState<"table" | "json">("table");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClear = useCallback(() => {
    setCsvText("");
    setSearch("");
    setSortCol(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  useEffect(() => {
    const onWipe = () => handleClear();
    window.addEventListener("flumenx:wipe_tool_data", onWipe);
    return () => {
      window.removeEventListener("flumenx:wipe_tool_data", onWipe);
    };
  }, [handleClear]);

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

  // JSON representation
  const jsonString = useMemo(() => {
    const list = parsedData.rows.map((r) => {
      const obj: Record<string, string> = {};
      parsedData.headers.forEach((h, i) => {
        obj[h || `col_${i}`] = r[i] || "";
      });
      return obj;
    });
    return JSON.stringify(list, null, 2);
  }, [parsedData]);

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        setCsvText(content);
        toast.success(`Loaded ${file.name} successfully!`);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("flumenx:touch_tool_data"));
        }
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
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `csv_export_${Date.now()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("JSON downloaded!");
  };

  const downloadCsv = () => {
    const blob = new Blob([csvText], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `data_${Date.now()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="tool-btn-primary"
            style={{ fontSize: "0.82rem", padding: "8px 14px" }}
          >
            <Upload size={14} />
            <span>Upload .CSV File</span>
          </button>
          {!csvText && (
            <button
              type="button"
              onClick={() => {
                setCsvText(SAMPLE_CSV);
                toast.info("Sample CSV loaded into memory.");
              }}
              className="tool-btn-secondary"
              style={{ fontSize: "0.82rem", padding: "8px 14px" }}
            >
              <FileText size={14} />
              <span>Load Sample CSV</span>
            </button>
          )}
          {csvText && (
            <>
              <button
                type="button"
                onClick={() => setViewMode(viewMode === "table" ? "json" : "table")}
                className="tool-btn-secondary"
                style={{ fontSize: "0.82rem", padding: "8px 14px" }}
              >
                {viewMode === "table" ? "View as JSON" : "View as Table"}
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="tool-btn-secondary"
                style={{ color: "#DC2626", borderColor: "#FCA5A5", fontSize: "0.82rem", padding: "8px 12px" }}
                title="Wipe CSV from memory"
              >
                <Trash2 size={13} />
                <span>Wipe CSV</span>
              </button>
            </>
          )}
        </div>

        {csvText && (
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
        )}
      </div>

      {!csvText ? (
        <div
          className="tool-dropzone"
          style={{ padding: "60px 20px" }}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files?.[0]) handleFileUpload(e.dataTransfer.files[0]);
          }}
        >
          <Table size={40} className="tool-dropzone-icon" />
          <div className="tool-dropzone-title">Upload or Drop a CSV File</div>
          <div className="tool-dropzone-sub">
            Files are processed strictly in browser memory. Nothing is ever uploaded to any server.
          </div>
        </div>
      ) : viewMode === "table" ? (
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
              Showing {displayRows.length} of {parsedData.rows.length} rows ({parsedData.headers.length} columns)
            </span>
          </div>

          {/* Interactive Data Table */}
          <div style={{ overflowX: "auto", border: "1px solid var(--tools-border)", borderRadius: "10px", backgroundColor: "var(--tools-surface)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ backgroundColor: "var(--tools-surface-subtle)", borderBottom: "1px solid var(--tools-border)" }}>
                  <th style={{ padding: "10px 12px", textAlign: "left", width: "40px", color: "var(--tools-text-muted)", fontSize: "0.75rem" }}>#</th>
                  {parsedData.headers.map((h, idx) => (
                    <th
                      key={idx}
                      onClick={() => handleHeaderClick(idx)}
                      style={{
                        padding: "10px 14px",
                        textAlign: "left",
                        fontWeight: 700,
                        color: "var(--tools-text)",
                        cursor: "pointer",
                        userSelect: "none",
                        whiteSpace: "nowrap",
                      }}
                      title="Click to sort column"
                    >
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <span>{h}</span>
                        <ArrowUpDown size={12} style={{ opacity: sortCol === idx ? 1 : 0.4 }} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayRows.length === 0 ? (
                  <tr>
                    <td colSpan={parsedData.headers.length + 1} style={{ padding: "40px 20px", textAlign: "center", color: "var(--tools-text-muted)" }}>
                      No matching rows found
                    </td>
                  </tr>
                ) : (
                  displayRows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      style={{
                        borderBottom: "1px solid var(--tools-border)",
                        backgroundColor: rIdx % 2 === 0 ? "transparent" : "var(--tools-surface-subtle)",
                      }}
                    >
                      <td style={{ padding: "10px 12px", color: "var(--tools-text-muted)", fontSize: "0.75rem" }}>
                        {rIdx + 1}
                      </td>
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} style={{ padding: "10px 14px", color: "var(--tools-text)" }}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--tools-text-muted)" }}>Parsed JSON Array:</span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(jsonString);
                toast.success("JSON copied to clipboard!");
              }}
              className="tool-btn-secondary"
              style={{ fontSize: "0.78rem", padding: "4px 10px" }}
            >
              <Copy size={12} />
              <span>Copy JSON</span>
            </button>
          </div>
          <pre
            style={{
              padding: "16px",
              backgroundColor: "var(--tools-surface-subtle)",
              borderRadius: "10px",
              border: "1px solid var(--tools-border)",
              fontFamily: "ui-monospace, monospace",
              fontSize: "0.82rem",
              maxHeight: "480px",
              overflowY: "auto",
              color: "var(--tools-text)",
            }}
          >
            {jsonString}
          </pre>
        </div>
      )}
    </div>
  );
}
