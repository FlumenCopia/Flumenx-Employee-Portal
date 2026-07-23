"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarPlus, Check, Download, FileUp, Megaphone, Pencil, Plus, Search, Trash2, UserPlus, X } from "lucide-react";
import { announcements as demoAnnouncements, employees as demoEmployees, leaves as demoLeaves, meetings as demoMeetings, salarySlips as demoSlips } from "@/lib/demo-data";
import { Announcement, Employee, Leave, Meeting, SalarySlip } from "@/lib/types";
import { api } from "@/lib/api";
import { Avatar } from "./icons";
import { Badge, EmptyState, PageHeader, PrimaryButton, Section } from "./ui";

const monthName = (m: number) => new Date(2024, m - 1).toLocaleDateString("en-US", { month: "long" });

export function EmployeesPage() {
  const [items, setItems] = useState(demoEmployees); const [search, setSearch] = useState(""); const [department, setDepartment] = useState("All");
  const loadEmployees = () => api<{results:Employee[]}>("/employees/").then(data=>setItems(data.results)).catch(()=>{});
  useEffect(()=>{loadEmployees()},[]);
  async function removeEmployee(id: number) {
    try {
      await api(`/employees/${id}/`, { method: "DELETE" });
      setItems(items.filter(x => x.id !== id));
    } catch {}
  }
  const shown = useMemo(() => items.filter(e => (department === "All" || e.department === department) && `${e.name} ${e.email} ${e.employee_code}`.toLowerCase().includes(search.toLowerCase())), [items, search, department]);
  return <>
    <PageHeader eyebrow="PEOPLE / DIRECTORY" title="Your people." subtitle="A clear view of everyone building FLUMENX." action={<Link className="primary-button" href="/admin/employees/create">Add employee <UserPlus size={17} /></Link>} />
    <div className="toolbar"><div className="search-box"><Search size={18} /><input placeholder="Search name, email or IDâ€¦" value={search} onChange={e => setSearch(e.target.value)} /></div><select value={department} onChange={e => setDepartment(e.target.value)}><option>All</option>{["Engineering","Design","HR","Finance","Sales","Operations"].map(x => <option key={x}>{x}</option>)}</select><div className="record-count">{shown.length} PEOPLE</div></div>
    <div className="data-card">
      <div className="data-table employees-table">
        <div className="table-head"><span>Employee</span><span>Department</span><span>Role</span><span>Joined</span><span>Status</span><span /></div>
        {shown.map(e => <div className="table-row" key={e.id}><div className="person-cell"><Avatar name={e.name} /><div><Link href={`/admin/employees/${e.id}`}>{e.name}</Link><span>{e.employee_code} Â· {e.email}</span></div></div><span>{e.department}</span><span>{e.designation}</span><span>{new Date(e.joining_date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span><Badge tone={e.status}>{e.status}</Badge><div className="row-actions"><Link href={`/admin/employees/${e.id}`}><Pencil size={16} /></Link><button onClick={() => removeEmployee(e.id)}><Trash2 size={16} /></button></div></div>)}
      </div>
      {!shown.length && <EmptyState title="No people found" text="Try a different search or department." />}
    </div>
  </>;
}

export function EmployeeForm({ employee }: { employee?: Employee }) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const body = {
      employee_code: data.get("employee_code"), name: data.get("name"), email: data.get("email"),
      phone: data.get("phone"), department: data.get("department"), designation: data.get("designation"),
      joining_date: data.get("joining_date"), status: data.get("status"), location: data.get("location"),
      ...(!employee ? { password: data.get("password") } : {}),
    };
    await api(employee ? `/employees/${employee.id}/` : "/employees/", {
      method: employee ? "PUT" : "POST",
      body: JSON.stringify(body),
    });
    setSaved(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => router.push("/admin/employees"), 500);
  }
  return <>
    <PageHeader eyebrow="PEOPLE / RECORD" title={employee ? "Employee profile." : "Add someone new."} subtitle={employee ? "Review and update this employee record." : "Create their FLUMENX identity and workspace access."} />
    {saved && <div className="toast success"><Check size={18} /> Employee record saved successfully.</div>}
    <form className="editor-card" onSubmit={submit}>
      <div className="editor-intro"><span>01</span><div><h2>Core information</h2><p>The details used across the employee directory.</p></div></div>
      <div className="form-grid">
        <label>Employee code<input name="employee_code" defaultValue={employee?.employee_code || `FLX-${String(demoEmployees.length + 1).padStart(3, "0")}`} required /></label>
        <label>Full name<input name="name" defaultValue={employee?.name} placeholder="e.g. Nisha Verma" required /></label>
        <label>Work email<input name="email" defaultValue={employee?.email} type="email" placeholder="name@flumenx.local" required /></label>
        <label>Phone number<input name="phone" defaultValue={employee?.phone} placeholder="+91" required /></label>
        <label>Department<select name="department" defaultValue={employee?.department || ""} required><option value="" disabled>Select department</option>{["Engineering","Design","HR","Finance","Sales","Operations"].map(x => <option key={x}>{x}</option>)}</select></label>
        <label>Designation<input name="designation" defaultValue={employee?.designation} placeholder="Role title" required /></label>
        <label>Joining date<input name="joining_date" defaultValue={employee?.joining_date} type="date" required /></label>
        <label>Status<select name="status" defaultValue={employee?.status || "Active"}><option>Active</option><option>On Leave</option><option>Inactive</option></select></label>
        <label>Location<input name="location" defaultValue={employee?.location} placeholder="City" /></label>
        {!employee && <label>Temporary password<input name="password" defaultValue="Flumenx@123" type="text" required /></label>}
      </div>
      <div className="form-actions"><Link href="/admin/employees">Cancel</Link><PrimaryButton type="submit">{employee ? "Save changes" : "Create employee"}</PrimaryButton></div>
    </form>
  </>;
}

export function LeavesPage({ employee = false }: { employee?: boolean }) {
  const [items, setItems] = useState(employee ? demoLeaves.filter(x => x.employee === 1) : demoLeaves); const [modal, setModal] = useState(false);
  const loadLeaves = () => api<{results:Leave[]}>("/leaves/").then(data=>setItems(data.results)).catch(()=>{});
  useEffect(()=>{loadLeaves()},[]);
  async function decide(id: number, status: "Approved" | "Rejected") {
    const updated = await api<Leave>(`/leaves/${id}/decide/`, { method: "POST", body: JSON.stringify({ status }) });
    setItems(items.map(x => x.id === id ? updated : x));
  }
  async function requestLeave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    await api<Leave>("/leaves/", {
      method: "POST",
      body: JSON.stringify({
        leave_type: data.get("leave_type"),
        start_date: data.get("start_date"),
        end_date: data.get("end_date"),
        reason: data.get("reason"),
      }),
    });
    setModal(false);
    loadLeaves();
  }
  return <>
    <PageHeader eyebrow={employee ? "TIME OFF / MY LEAVE" : "PEOPLE / LEAVE REQUESTS"} title={employee ? "Time away." : "Leave requests."} subtitle={employee ? "Plan time off and follow every request." : "Review requests with context and care."} action={employee ? <PrimaryButton onClick={() => setModal(true)}>Request leave</PrimaryButton> : undefined} />
    <div className="mini-metrics"><div><span>{employee ? "AVAILABLE" : "PENDING"}</span><strong>{employee ? "14" : items.filter(x => x.status === "Pending").length}</strong><small>{employee ? "of 24 annual days" : "awaiting review"}</small></div><div><span>APPROVED</span><strong>{items.filter(x => x.status === "Approved").length}</strong><small>this year</small></div><div><span>{employee ? "USED" : "REJECTED"}</span><strong>{employee ? "10" : items.filter(x => x.status === "Rejected").length}</strong><small>{employee ? "days this year" : "this year"}</small></div></div>
    <Section title={employee ? "Request history" : "Requests in review"} kicker="LEAVE / 2026">
      <div className="data-table leave-table"><div className="table-head">{!employee && <span>Employee</span>}<span>Leave type</span><span>Dates</span><span>Duration</span><span>Reason</span><span>Status</span>{!employee && <span />}</div>
      {items.map(l => <div className="table-row" key={l.id}>{!employee && <div className="person-cell"><Avatar name={l.employee_name || ""} /><div><b>{l.employee_name}</b><span>{l.employee_code}</span></div></div>}<b>{l.leave_type}</b><span>{new Date(l.start_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} â€“ {new Date(l.end_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span><span>{l.days} day{l.days === 1 ? "" : "s"}</span><span className="truncate">{l.reason}</span><Badge tone={l.status}>{l.status}</Badge>{!employee && <div className="decision-buttons">{l.status === "Pending" && <><button className="approve" onClick={() => decide(l.id, "Approved")}><Check size={16} /></button><button className="reject" onClick={() => decide(l.id, "Rejected")}><X size={16} /></button></>}</div>}</div>)}</div>
    </Section>
    {modal && <Modal title="Request time off" onClose={() => setModal(false)}><form onSubmit={requestLeave} className="modal-form"><label>Leave type<select name="leave_type"><option>Annual</option><option>Sick</option><option>Personal</option><option>Unpaid</option></select></label><div className="two-col"><label>From<input name="start_date" type="date" required /></label><label>To<input name="end_date" type="date" required /></label></div><label>Reason<textarea name="reason" placeholder="A short note for your manager" required /></label><PrimaryButton type="submit">Submit request</PrimaryButton></form></Modal>}
  </>;
}

export function SalaryPage({ employee = false }: { employee?: boolean }) {
  const fallback: SalarySlip[] = employee ? demoSlips : demoEmployees.flatMap((e, i) => demoSlips.slice(0, i < 3 ? 2 : 1).map((s, n) => ({ ...s, id: i * 10 + n, employee: e.id, employee_name: e.name })));
  const [data,setData]=useState(fallback);
  const [employeeOptions, setEmployeeOptions] = useState(demoEmployees);
  const loadSlips = () => api<{results:SalarySlip[]}>("/salary-slips/").then(result=>setData(result.results)).catch(()=>{});
  useEffect(()=>{
    loadSlips();
    if (!employee) api<{results:Employee[]}>("/employees/").then(result=>setEmployeeOptions(result.results)).catch(()=>{});
  },[employee]);
  const [modal, setModal] = useState(false);
  async function uploadSlip(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await api<SalarySlip>("/salary-slips/", { method: "POST", body: form });
    setModal(false);
    loadSlips();
  }
  return <>
    <PageHeader eyebrow="PAYROLL / DOCUMENTS" title={employee ? "Your payslips." : "Salary slips."} subtitle={employee ? "Private, secure, and ready when you need them." : "Upload and manage monthly payroll documents."} action={!employee ? <PrimaryButton onClick={() => setModal(true)}>Upload slips</PrimaryButton> : undefined} />
    <div className="document-banner"><div><span>{employee ? "LATEST NET PAY" : "JUNE PAYROLL"}</span><strong>{employee ? "â‚¹1,08,500" : "94%"}</strong><p>{employee ? "May 2026 Â· processed" : "139 of 148 employee slips uploaded"}</p></div><div className="progress-ring">{employee ? "PDF" : "94"}<small>{employee ? "READY" : "%"}</small></div></div>
    <Section title={employee ? "Payslip arcflumenx" : "Recent uploads"} kicker="DOCUMENTS / SECURE">
      <div className="data-table salary-table"><div className="table-head">{!employee && <span>Employee</span>}<span>Pay period</span><span>Gross salary</span><span>Net salary</span><span>Uploaded</span><span /></div>
      {data.map(s => <div className="table-row" key={s.id}>{!employee && <div className="person-cell"><Avatar name={s.employee_name || ""} /><b>{s.employee_name}</b></div>}<b>{monthName(s.month)} {s.year}</b><span>â‚¹{Number(s.gross_salary).toLocaleString("en-IN")}</span><strong>â‚¹{Number(s.net_salary).toLocaleString("en-IN")}</strong><span>{new Date(s.uploaded_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span><button className="download-button"><Download size={17} /> Download</button></div>)}</div>
    </Section>
    {modal && <Modal title="Upload salary slip" onClose={() => setModal(false)}><form className="modal-form" onSubmit={uploadSlip}><label>Employee<select name="employee">{employeeOptions.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label><div className="two-col"><label>Month<select name="month">{Array.from({length:12},(_,i)=><option key={i} value={i+1}>{monthName(i+1)}</option>)}</select></label><label>Year<input name="year" defaultValue="2026" type="number" /></label></div><div className="two-col"><label>Gross salary<input name="gross_salary" defaultValue="125000" type="number" step=".01" required /></label><label>Net salary<input name="net_salary" defaultValue="108500" type="number" step=".01" required /></label></div><label className="file-drop"><FileUp /><b>Choose PDF payslip</b><span>Maximum file size 10 MB</span><input name="file" type="file" accept=".pdf" /></label><PrimaryButton type="submit">Upload document</PrimaryButton></form></Modal>}
  </>;
}

export function MeetingsPage({ employee = false }: { employee?: boolean }) {
  const [items, setItems] = useState(demoMeetings); const [modal, setModal] = useState(false);
  const loadMeetings = () => api<{results:Meeting[]}>("/meetings/").then(data=>setItems(data.results)).catch(()=>{});
  useEffect(()=>{loadMeetings()},[]);
  async function createMeeting(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    await api<Meeting>("/meetings/", { method: "POST", body: JSON.stringify({
      title: data.get("title"), date: data.get("date"), time: data.get("time"),
      department: data.get("department"), description: data.get("description"), location: data.get("location"),
    }) });
    setModal(false);
    loadMeetings();
  }
  async function deleteMeeting(id: number) {
    await api(`/meetings/${id}/`, { method: "DELETE" });
    setItems(items.filter(x=>x.id!==id));
  }
  return <>
    <PageHeader eyebrow="CALENDAR / ALIGNMENT" title="Meetings." subtitle={employee ? "The conversations shaping your week." : "Create space for decisions and shared direction."} action={!employee ? <PrimaryButton onClick={() => setModal(true)}>Schedule meeting</PrimaryButton> : undefined} />
    <div className="meeting-layout"><div className="date-poster"><span>NEXT UP</span><strong>{items[0] ? new Date(items[0].date).getDate() : "--"}</strong><h3>{items[0] ? new Date(items[0].date).toLocaleDateString("en-US",{month:"long",weekday:"long"}) : "No meetings"}</h3><p>{items[0] ? `${items[0].time.slice(0,5)} Â· ${items[0].location}` : "Schedule the next meeting"}</p></div><div className="meeting-stack">{items.map((m,i)=><article key={m.id}><div className="meeting-number">0{i+1}</div><div><Badge tone={i===0?"Important":"neutral"}>{m.department}</Badge><h2>{m.title}</h2><p>{m.description}</p><span>{new Date(m.date).toLocaleDateString("en-IN",{day:"2-digit",month:"long"})} Â· {m.time.slice(0,5)} Â· {m.location}</span></div>{!employee && <button onClick={()=>deleteMeeting(m.id)}><Trash2 size={17}/></button>}</article>)}</div></div>
    {modal && <Modal title="Schedule a meeting" onClose={() => setModal(false)}><form className="modal-form" onSubmit={createMeeting}><label>Meeting title<input name="title" required placeholder="What are we aligning on?" /></label><div className="two-col"><label>Date<input name="date" type="date" required /></label><label>Time<input name="time" type="time" required /></label></div><label>Audience<select name="department"><option>All Employees</option>{["Engineering","Design","HR","Finance","Sales","Operations"].map(x=><option key={x}>{x}</option>)}</select></label><label>Location<input name="location" required placeholder="Room or link" /></label><label>Description<textarea name="description" /></label><PrimaryButton type="submit">Create meeting</PrimaryButton></form></Modal>}
  </>;
}

export function AnnouncementsPage({ employee = false }: { employee?: boolean }) {
  const [items, setItems] = useState(demoAnnouncements); const [modal,setModal]=useState(false);
  const loadAnnouncements = () => api<{results:Announcement[]}>("/announcements/").then(data=>setItems(data.results)).catch(()=>{});
  useEffect(()=>{loadAnnouncements()},[]);
  async function createAnnouncement(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    await api<Announcement>("/announcements/", { method: "POST", body: JSON.stringify({
      title: data.get("title"), priority: data.get("priority"), message: data.get("message"),
    }) });
    setModal(false);
    loadAnnouncements();
  }
  async function deleteAnnouncement(id: number) {
    await api(`/announcements/${id}/`, { method: "DELETE" });
    setItems(items.filter(x=>x.id!==id));
  }
  return <><PageHeader eyebrow="NOTICEBOARD / COMPANY" title="Announcements." subtitle="The things everyone should know, in one clear place." action={!employee?<PrimaryButton onClick={()=>setModal(true)}>New announcement</PrimaryButton>:undefined}/>
    <div className="announcement-page-grid">{items.map((a,i)=><article key={a.id} className={i===0?"featured":""}><div className="announce-meta"><span>0{i+1}</span><Badge tone={a.priority}>{a.priority}</Badge></div><h2>{a.title}</h2><p>{a.message}</p><div className="announce-foot"><time>{new Date(a.date).toLocaleDateString("en-IN",{day:"2-digit",month:"long",year:"numeric"})}</time>{!employee&&<button onClick={()=>deleteAnnouncement(a.id)}><Trash2 size={16}/></button>}</div></article>)}</div>
    {modal&&<Modal title="Share an announcement" onClose={()=>setModal(false)}><form className="modal-form" onSubmit={createAnnouncement}><label>Title<input name="title" required placeholder="A clear headline" /></label><label>Priority<select name="priority"><option>Normal</option><option>Important</option><option>Urgent</option></select></label><label>Message<textarea name="message" required rows={5} placeholder="What does the team need to know?" /></label><PrimaryButton type="submit">Publish update</PrimaryButton></form></Modal>}</>;
}

export function ProfilePage() {
  const e=demoEmployees[0]; return <><PageHeader eyebrow="IDENTITY / PROFILE" title="Your profile." subtitle="The details that help your team know and reach you."/><div className="profile-page-card"><div className="profile-cover"><span>FLUMENX / ENGINEERING</span></div><div className="profile-main"><Avatar name={e.name} size={96}/><div><span>{e.employee_code}</span><h2>{e.name}</h2><p>{e.designation}</p></div><button><Pencil size={17}/> Edit details</button></div><div className="profile-facts">{[["WORK EMAIL",e.email],["PHONE",e.phone],["DEPARTMENT",e.department],["LOCATION",e.location||""],["JOINED",new Date(e.joining_date).toLocaleDateString("en-IN",{day:"2-digit",month:"long",year:"numeric"})],["STATUS",e.status]].map(([k,v])=><div key={k}><span>{k}</span><b>{v}</b></div>)}</div></div></>;
}

function Modal({ title, onClose, children }: { title:string;onClose:()=>void;children:React.ReactNode }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><div><span>FLUMENX / CREATE</span><h2>{title}</h2></div><button onClick={onClose}><X/></button></div>{children}</div></div>;
}


