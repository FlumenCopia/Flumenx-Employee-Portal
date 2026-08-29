"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  CreditCard,
  Download,
  FileText,
  History,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Receipt,
  Shield,
  ShieldCheck,
  Trash2,
  Upload,
  User,
  UserCheck,
  Wallet,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/components/ToastContext";
import { Avatar } from "@/components/icons";
import { Badge, EmptyState, PageHeader, PrimaryButton, Section } from "@/components/ui";
import { Modal } from "@/features/common/Modal";
import { EmployeeDocumentsModal } from "./EmployeeDocumentsModal";
import { EmployeeForm } from "./EmployeesPage";
import { getCachedAuthUser } from "@/lib/auth-cache";
import { getISTDateString } from "@/lib/tzUtils";

interface EmployeeProfileDetail {
  id: string;
  employee_code: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  joining_date: string;
  status: string;
  employment_status: string;
  probation_start_date?: string | null;
  probation_end_date?: string | null;
  confirmation_date?: string | null;
  exit_date?: string | null;
  location: string;
  avatar: string;
  team_lead?: { id: string; name: string; code: string } | null;
  user?: { id: string; username: string; role: string } | null;
  salary_structure?: {
    id: string;
    gross_salary: number;
    basic_salary: number;
    hra: number;
    conveyance: number;
    special_allowance: number;
    other_allowances: number;
    pf_applicable: boolean;
    voluntary_pf: boolean;
    esi_applicable: boolean;
    professional_tax_applicable: boolean;
    professional_tax: number;
    tds_applicable: boolean;
    tds: number;
    salary_history: any[];
  } | null;
  leave_balances?: {
    sick: number;
    casual: number;
  };
}

export function EmployeeDetailPage({ id, role = "admin" }: { id: string; role?: "admin" | "hr" }) {
  const router = useRouter();
  const [profile, setProfile] = useState<EmployeeProfileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"salary" | "personal" | "documents" | "history">("salary");

  // Modals
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [docsModalOpen, setDocsModalOpen] = useState(false);
  const [salaryModalOpen, setSalaryModalOpen] = useState(false);

  // Salary Structure Edit State
  const [structGross, setStructGross] = useState(50000);
  const [structBasic, setStructBasic] = useState(25000);
  const [structHra, setStructHra] = useState(12500);
  const [structConveyance, setStructConveyance] = useState(3000);
  const [structSpecial, setStructSpecial] = useState(9500);
  const [structOther, setStructOther] = useState(0);
  const [structPfApplicable, setStructPfApplicable] = useState(true);
  const [structVoluntaryPf, setStructVoluntaryPf] = useState(false);
  const [structEsiApplicable, setStructEsiApplicable] = useState(false);
  const [structProfTaxApplicable, setStructProfTaxApplicable] = useState(true);
  const [structProfTax, setStructProfTax] = useState(200);
  const [structTdsApplicable, setStructTdsApplicable] = useState(false);
  const [structTds, setStructTds] = useState(0);
  const [structNotes, setStructNotes] = useState("");
  const [savingSalary, setSavingSalary] = useState(false);

  const currentUser = getCachedAuthUser();
  const canManage =
    role === "admin" ||
    role === "hr" ||
    currentUser?.role === "SUPER_ADMIN" ||
    currentUser?.role === "ADMIN" ||
    currentUser?.role === "HR" ||
    Boolean((currentUser as any)?.isSuperuser);

  const loadProfile = () => {
    setLoading(true);
    setError("");
    api<EmployeeProfileDetail>(`/employees/${id}/`)
      .then((data) => {
        setProfile(data);
        if (data.salary_structure) {
          setStructGross(data.salary_structure.gross_salary || 50000);
          setStructBasic(data.salary_structure.basic_salary || 25000);
          setStructHra(data.salary_structure.hra || 12500);
          setStructConveyance(data.salary_structure.conveyance || 3000);
          setStructSpecial(data.salary_structure.special_allowance || 9500);
          setStructOther(data.salary_structure.other_allowances || 0);
          setStructPfApplicable(data.salary_structure.pf_applicable);
          setStructVoluntaryPf(data.salary_structure.voluntary_pf);
          setStructEsiApplicable(data.salary_structure.esi_applicable);
          setStructProfTaxApplicable(data.salary_structure.professional_tax_applicable);
          setStructProfTax(data.salary_structure.professional_tax || 200);
          setStructTdsApplicable(data.salary_structure.tds_applicable);
          setStructTds(data.salary_structure.tds || 0);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load employee details.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (id) loadProfile();
  }, [id]);

  const handleSaveSalaryStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSavingSalary(true);
    try {
      await api(`/salary-structures/`, {
        method: "POST",
        body: JSON.stringify({
          employee: profile.id,
          effectiveFrom: getISTDateString(),
          grossSalary: structGross,
          basicSalary: structBasic,
          hra: structHra,
          conveyance: structConveyance,
          specialAllowance: structSpecial,
          otherAllowances: structOther,
          pfApplicable: structPfApplicable,
          voluntaryPfAboveCeiling: structVoluntaryPf,
          esiApplicable: structEsiApplicable,
          professionalTaxApplicable: structProfTaxApplicable,
          professionalTax: structProfTax,
          tdsApplicable: structTdsApplicable,
          tds: structTds,
          notes: structNotes,
        }),
      });
      setSalaryModalOpen(false);
      toast.success("Salary structure saved successfully.");
      loadProfile();
    } catch (err: any) {
      toast.error(err.message || "Failed to save salary structure");
    } finally {
      setSavingSalary(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center", color: "#64748B" }}>
        Loading complete employee profile...
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div style={{ padding: "30px 20px" }}>
        <EmptyState title="Employee not found" text={error || "Could not retrieve employee details."} />
        <div style={{ marginTop: "16px", textAlign: "center" }}>
          <Link href={`/${role}/employees`} style={{ color: "#087A5B", fontWeight: 600, textDecoration: "none" }}>
            ← Back to Employees Directory
          </Link>
        </div>
      </div>
    );
  }

  const s = profile.salary_structure;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Top Breadcrumb & Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <Link
          href={`/${role}/employees`}
          style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#64748B", textDecoration: "none", fontSize: "14px", fontWeight: 600 }}
        >
          <ArrowLeft size={16} />
          Back to Directory
        </Link>

        {canManage && (
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => setDocsModalOpen(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                backgroundColor: "#FFFFFF",
                border: "1px solid #CBD5E1",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 600,
                color: "#334155",
                cursor: "pointer",
              }}
            >
              <FileText size={15} />
              Document Vault
            </button>
            <button
              onClick={() => setSalaryModalOpen(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                backgroundColor: "#F0FDF4",
                border: "1px solid #A7F3D0",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 600,
                color: "#087A5B",
                cursor: "pointer",
              }}
            >
              <Wallet size={15} />
              {s ? "Update Salary Structure" : "Configure Salary"}
            </button>
            {profile.employment_status === "Probation" && (
              <button
                onClick={async () => {
                  if (confirm(`Confirm ${profile.name} as Permanent employee? This will graduate them from probation and unlock leave benefits.`)) {
                    try {
                      await api(`/employees/${profile.id}/`, {
                        method: "PUT",
                        body: JSON.stringify({ employment_status: "Permanent", confirmation_date: getISTDateString() }),
                      });
                      toast.success("Employment status updated to Permanent!");
                      loadProfile();
                    } catch (err: any) {
                      toast.error(err.message || "Failed to update employment status");
                    }
                  }
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 14px",
                  backgroundColor: "#EFF6FF",
                  border: "1px solid #93C5FD",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#1D4ED8",
                  cursor: "pointer",
                }}
              >
                <UserCheck size={15} />
                Confirm Employee
              </button>
            )}
            <button
              onClick={() => setEditModalOpen(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                backgroundColor: "#087A5B",
                border: "none",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 600,
                color: "#FFFFFF",
                cursor: "pointer",
              }}
            >
              <Pencil size={15} />
              Edit Profile
            </button>
          </div>
        )}
      </div>

      {/* Main Profile Header Card */}
      <div
        style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "16px",
              backgroundColor: "#E6F4EA",
              color: "#087A5B",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "26px",
              fontWeight: 800,
            }}
          >
            {profile.name.charAt(0)}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "#0F172A" }}>{profile.name}</h2>
              <span style={{ fontSize: "12px", fontWeight: 700, padding: "2px 8px", borderRadius: "6px", backgroundColor: "#F1F5F9", color: "#475569" }}>
                {profile.employee_code}
              </span>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: "6px",
                  backgroundColor: profile.status === "Active" ? "#ECFDF5" : "#FEF2F2",
                  color: profile.status === "Active" ? "#065F46" : "#DC2626",
                }}
              >
                {profile.status}
              </span>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: "6px",
                  backgroundColor: profile.employment_status === "Permanent" ? "#EFF6FF" : "#FEF3C7",
                  color: profile.employment_status === "Permanent" ? "#1E40AF" : "#92400E",
                }}
              >
                {profile.employment_status}
              </span>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: "14px", color: "#64748B" }}>
              {profile.designation} • <strong style={{ color: "#334155" }}>{profile.department}</strong>
            </p>
          </div>
        </div>

        {/* Key Fast Stats */}
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ padding: "12px 18px", backgroundColor: "#F8FAFC", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748B" }}>Monthly Gross</div>
            <div style={{ fontSize: "18px", fontWeight: 800, color: "#087A5B" }}>
              {s ? `₹${s.gross_salary?.toLocaleString()}` : "Not Set"}
            </div>
          </div>
          <div style={{ padding: "12px 18px", backgroundColor: "#F8FAFC", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748B" }}>Sick Balance</div>
            <div style={{ fontSize: "18px", fontWeight: 800, color: "#0F172A" }}>
              {profile.leave_balances?.sick ?? 0} Days
            </div>
          </div>
          <div style={{ padding: "12px 18px", backgroundColor: "#F8FAFC", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748B" }}>Casual Balance</div>
            <div style={{ fontSize: "18px", fontWeight: 800, color: "#0F172A" }}>
              {profile.leave_balances?.casual ?? 0} Days
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Header */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid #E2E8F0", paddingBottom: "8px", overflowX: "auto", WebkitOverflowScrolling: "touch", whiteSpace: "nowrap" }}>
        {[
          { key: "salary", label: "Salary & Compensation", icon: Wallet },
          { key: "personal", label: "Personal & Job Details", icon: User },
          { key: "documents", label: "Document Vault", icon: FileText },
          { key: "history", label: "Salary History & Revisions", icon: History },
        ].map((t) => {
          const Icon = t.icon;
          const isAct = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as any)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: isAct ? 700 : 500,
                color: isAct ? "#FFFFFF" : "#475569",
                backgroundColor: isAct ? "#087A5B" : "transparent",
                border: "none",
                cursor: "pointer",
                transition: "all 0.15s ease",
                flexShrink: 0,
              }}
            >
              <Icon size={16} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: SALARY & COMPENSATION */}
      {activeTab === "salary" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {s ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "20px" }}>
              {/* Earnings Card */}
              <div style={{ backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>Earnings Breakdown</h4>
                  <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "10px", backgroundColor: "#ECFDF5", color: "#065F46" }}>
                    Monthly Fixed
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", paddingBottom: "8px", borderBottom: "1px solid #F1F5F9" }}>
                    <span style={{ color: "#64748B" }}>Basic Salary</span>
                    <strong style={{ color: "#0F172A" }}>₹{s.basic_salary?.toLocaleString()}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", paddingBottom: "8px", borderBottom: "1px solid #F1F5F9" }}>
                    <span style={{ color: "#64748B" }}>House Rent Allowance (HRA)</span>
                    <strong style={{ color: "#0F172A" }}>₹{s.hra?.toLocaleString()}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", paddingBottom: "8px", borderBottom: "1px solid #F1F5F9" }}>
                    <span style={{ color: "#64748B" }}>Conveyance Allowance</span>
                    <strong style={{ color: "#0F172A" }}>₹{s.conveyance?.toLocaleString()}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", paddingBottom: "8px", borderBottom: "1px solid #F1F5F9" }}>
                    <span style={{ color: "#64748B" }}>Special Allowance</span>
                    <strong style={{ color: "#0F172A" }}>₹{s.special_allowance?.toLocaleString()}</strong>
                  </div>
                  {s.other_allowances > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", paddingBottom: "8px", borderBottom: "1px solid #F1F5F9" }}>
                      <span style={{ color: "#64748B" }}>Other Allowances</span>
                      <strong style={{ color: "#0F172A" }}>₹{s.other_allowances?.toLocaleString()}</strong>
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "15px", paddingTop: "8px", borderTop: "2px solid #E2E8F0", marginTop: "4px" }}>
                    <strong style={{ color: "#0F172A" }}>Total Fixed Monthly Gross</strong>
                    <strong style={{ color: "#087A5B", fontSize: "17px" }}>₹{s.gross_salary?.toLocaleString()}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#64748B" }}>
                    <span>Annual Cost to Company (CTC)</span>
                    <strong>₹{(s.gross_salary * 12)?.toLocaleString()} / yr</strong>
                  </div>
                </div>
              </div>

              {/* Statutory Flags & Deductions Card */}
              <div style={{ backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>Statutory & Deductions</h4>
                  <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "10px", backgroundColor: "#EFF6FF", color: "#1E40AF" }}>
                    Compliance
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "8px", borderBottom: "1px solid #F1F5F9" }}>
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A" }}>Provident Fund (PF)</div>
                      <div style={{ fontSize: "11px", color: "#64748B" }}>12% of Basic (Wage ceiling ₹15,000)</div>
                    </div>
                    <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "6px", backgroundColor: s.pf_applicable ? "#ECFDF5" : "#F1F5F9", color: s.pf_applicable ? "#065F46" : "#94A3B8" }}>
                      {s.pf_applicable ? (s.voluntary_pf ? "12% Full Basic (Voluntary)" : "Applicable (12%)") : "Not Applicable"}
                    </span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "8px", borderBottom: "1px solid #F1F5F9" }}>
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A" }}>Employee State Insurance (ESI)</div>
                      <div style={{ fontSize: "11px", color: "#64748B" }}>0.75% of Gross (Ceiling ₹21,000)</div>
                    </div>
                    <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "6px", backgroundColor: s.esi_applicable ? "#ECFDF5" : "#F1F5F9", color: s.esi_applicable ? "#065F46" : "#94A3B8" }}>
                      {s.esi_applicable ? "Applicable (0.75%)" : "Not Applicable"}
                    </span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "8px", borderBottom: "1px solid #F1F5F9" }}>
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A" }}>Professional Tax (PT)</div>
                      <div style={{ fontSize: "11px", color: "#64748B" }}>State statutory tax deduction</div>
                    </div>
                    <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "6px", backgroundColor: s.professional_tax_applicable ? "#ECFDF5" : "#F1F5F9", color: s.professional_tax_applicable ? "#065F46" : "#94A3B8" }}>
                      {s.professional_tax_applicable ? `₹${s.professional_tax || 200}` : "Not Applicable"}
                    </span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A" }}>Income Tax TDS</div>
                      <div style={{ fontSize: "11px", color: "#64748B" }}>Monthly tax deduction at source</div>
                    </div>
                    <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "6px", backgroundColor: s.tds_applicable ? "#ECFDF5" : "#F1F5F9", color: s.tds_applicable ? "#065F46" : "#94A3B8" }}>
                      {s.tds_applicable ? `₹${s.tds}` : "No TDS"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "32px", textAlign: "center" }}>
              <Wallet size={40} color="#94A3B8" style={{ margin: "0 auto 12px" }} />
              <h4 style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>
                No Salary Structure Configured
              </h4>
              <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#64748B" }}>
                Configure this employee&apos;s monthly gross, earnings breakdown, and statutory PF/ESI flags.
              </p>
              {canManage && (
                <button
                  onClick={() => setSalaryModalOpen(true)}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#087A5B",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Configure Salary Structure Now
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PERSONAL & JOB DETAILS */}
      {activeTab === "personal" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "20px" }}>
          <div style={{ backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "20px" }}>
            <h4 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>Job Information</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "8px", borderBottom: "1px solid #F1F5F9" }}>
                <span style={{ color: "#64748B" }}>Employee Code</span>
                <strong style={{ color: "#0F172A" }}>{profile.employee_code}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "8px", borderBottom: "1px solid #F1F5F9" }}>
                <span style={{ color: "#64748B" }}>Department</span>
                <strong style={{ color: "#0F172A" }}>{profile.department}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "8px", borderBottom: "1px solid #F1F5F9" }}>
                <span style={{ color: "#64748B" }}>Designation</span>
                <strong style={{ color: "#0F172A" }}>{profile.designation}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "8px", borderBottom: "1px solid #F1F5F9" }}>
                <span style={{ color: "#64748B" }}>Date of Joining</span>
                <strong style={{ color: "#0F172A" }}>{profile.joining_date || "N/A"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "8px", borderBottom: "1px solid #F1F5F9" }}>
                <span style={{ color: "#64748B" }}>Reporting Lead</span>
                <strong style={{ color: "#0F172A" }}>{profile.team_lead?.name || "Direct to Operations"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748B" }}>Office Location</span>
                <strong style={{ color: "#0F172A" }}>{profile.location}</strong>
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "20px" }}>
            <h4 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>Contact & Portal Identity</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "8px", borderBottom: "1px solid #F1F5F9" }}>
                <span style={{ color: "#64748B" }}>Email Address</span>
                <strong style={{ color: "#0F172A" }}>{profile.email}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "8px", borderBottom: "1px solid #F1F5F9" }}>
                <span style={{ color: "#64748B" }}>Phone Number</span>
                <strong style={{ color: "#0F172A" }}>{profile.phone}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "8px", borderBottom: "1px solid #F1F5F9" }}>
                <span style={{ color: "#64748B" }}>Portal Username</span>
                <strong style={{ color: "#0F172A" }}>{profile.user?.username || "N/A"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748B" }}>Portal Role</span>
                <span style={{ fontSize: "12px", fontWeight: 700, padding: "2px 8px", borderRadius: "6px", backgroundColor: "#F1F5F9", color: "#334155" }}>
                  {profile.user?.role || "EMPLOYEE"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DOCUMENT VAULT */}
      {activeTab === "documents" && (
        <div style={{ backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>Secure Employee Document Vault</h4>
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748B" }}>
                Manage Aadhaar, PAN, Offer Letters, Relieving certificates, and IDs.
              </p>
            </div>
            {canManage && (
              <button
                onClick={() => setDocsModalOpen(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 16px",
                  backgroundColor: "#087A5B",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Upload size={15} />
                Upload New Document
              </button>
            )}
          </div>

          <div style={{ padding: "20px", backgroundColor: "#F8FAFC", borderRadius: "10px", textAlign: "center" }}>
            <FileText size={32} color="#64748B" style={{ margin: "0 auto 8px" }} />
            <p style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: 600, color: "#334155" }}>
              Access {profile.name}&apos;s verified compliance documents
            </p>
            <button
              onClick={() => setDocsModalOpen(true)}
              style={{
                padding: "8px 16px",
                backgroundColor: "#FFFFFF",
                border: "1px solid #CBD5E1",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 600,
                color: "#334155",
                cursor: "pointer",
              }}
            >
              Open Interactive Document Vault Modal
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: SALARY HISTORY */}
      {activeTab === "history" && (
        <div style={{ backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "24px" }}>
          <h4 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>Historical Salary Revisions</h4>
          {s?.salary_history && s.salary_history.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {s.salary_history.map((h: any, idx: number) => (
                <div key={idx} style={{ padding: "14px 16px", backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>
                      Gross: ₹{h.grossSalary?.toLocaleString()} • Basic: ₹{h.basicSalary?.toLocaleString()}
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748B" }}>
                      Effective: {h.effectiveFrom ? new Date(h.effectiveFrom).toLocaleDateString() : "Historical"} • {h.notes || "Salary Revision"}
                    </div>
                  </div>
                  <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px", backgroundColor: "#E2E8F0", color: "#475569" }}>
                    Archived
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: "13px", color: "#64748B" }}>No past revisions recorded. Current salary is the initial structure.</p>
          )}
        </div>
      )}

      {/* MODAL: Salary Structure Config */}
      {salaryModalOpen && (
        <Modal onClose={() => setSalaryModalOpen(false)} title={`Configure Salary Structure: ${profile.name}`}>
          <form onSubmit={handleSaveSalaryStructure} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>Fixed Monthly Gross (₹) *</label>
                <input
                  type="number"
                  value={structGross}
                  onChange={(e) => setStructGross(Number(e.target.value))}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>Basic Salary (₹) *</label>
                <input
                  type="number"
                  value={structBasic}
                  onChange={(e) => setStructBasic(Number(e.target.value))}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>HRA (₹)</label>
                <input
                  type="number"
                  value={structHra}
                  onChange={(e) => setStructHra(Number(e.target.value))}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Conveyance (₹)</label>
                <input
                  type="number"
                  value={structConveyance}
                  onChange={(e) => setStructConveyance(Number(e.target.value))}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Special Allowance (₹)</label>
                <input
                  type="number"
                  value={structSpecial}
                  onChange={(e) => setStructSpecial(Number(e.target.value))}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                />
              </div>
            </div>

            <div style={{ padding: "12px", backgroundColor: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A", marginBottom: "8px" }}>Statutory Compliance Flags</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "13px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="checkbox"
                    checked={structPfApplicable}
                    onChange={(e) => setStructPfApplicable(e.target.checked)}
                  />
                  <span>PF Applicable (12%)</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="checkbox"
                    checked={structVoluntaryPf}
                    onChange={(e) => setStructVoluntaryPf(e.target.checked)}
                  />
                  <span>Voluntary PF (Full Basic)</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="checkbox"
                    checked={structEsiApplicable}
                    onChange={(e) => setStructEsiApplicable(e.target.checked)}
                  />
                  <span>ESI Applicable (0.75%)</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="checkbox"
                    checked={structProfTaxApplicable}
                    onChange={(e) => setStructProfTaxApplicable(e.target.checked)}
                  />
                  <span>Professional Tax (₹200)</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="checkbox"
                    checked={structTdsApplicable}
                    onChange={(e) => setStructTdsApplicable(e.target.checked)}
                  />
                  <span>TDS Applicable</span>
                </label>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>Revision Notes / Rationale</label>
              <textarea
                value={structNotes}
                onChange={(e) => setStructNotes(e.target.value)}
                placeholder="Reason for salary revision or confirmation..."
                rows={2}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
              <button
                type="button"
                onClick={() => setSalaryModalOpen(false)}
                style={{ padding: "8px 16px", backgroundColor: "#F1F5F9", border: "1px solid #CBD5E1", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingSalary}
                style={{ padding: "8px 18px", backgroundColor: "#087A5B", color: "#FFFFFF", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}
              >
                {savingSalary ? "Saving Structure..." : "Save Salary Profile"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Profile Modal */}
      {editModalOpen && (
        <Modal title={`Edit Profile: ${profile.name}`} onClose={() => setEditModalOpen(false)}>
          <EmployeeForm
            employee={profile as any}
            role={role}
            onSuccess={() => {
              setEditModalOpen(false);
              loadProfile();
            }}
            onCancel={() => setEditModalOpen(false)}
          />
        </Modal>
      )}

      {/* Document Vault Modal */}
      <EmployeeDocumentsModal
        isOpen={docsModalOpen}
        onClose={() => setDocsModalOpen(false)}
        employee={profile as any}
      />
    </div>
  );
}
