import Link from "next/link";
import { ArrowRight, CalendarDays, Clock3, Download, LogIn, LogOut, TimerOff } from "lucide-react";
import { announcements, meetings, salarySlips } from "@/lib/demo-data";
import { Avatar } from "./icons";
import { Badge, PageHeader, Section, StatCard } from "./ui";

export function EmployeeDashboard() {
  return <>
    <PageHeader eyebrow="MY WORKSPACE Â· THURSDAY" title="Hello, Maya." subtitle="Everything you need, without the noise." />
    <div className="employee-hero">
      <div className="profile-feature"><Avatar name="Maya Kapoor" size={76} /><div><span>FLX-001 Â· ENGINEERING</span><h2>Maya Kapoor</h2><p>Senior Product Engineer Â· Bengaluru</p></div><Link href="/employee/profile">View profile <ArrowRight size={17} /></Link></div>
      <div className="leave-balance"><span>ANNUAL LEAVE</span><strong>14<small>/ 24 days</small></strong><div><i style={{ width: "58%" }} /></div><Link href="/employee/leaves">Request time off</Link></div>
    </div>
    <div className="stats-grid employee-stats">
      <StatCard label="Today's check-in" value="09:24" note="On time Â· Location verified" icon={<LogIn />} />
      <StatCard label="Today's checkout" value="18:38" note="Normal checkout" icon={<LogOut />} />
      <StatCard label="Late this month" value="03" note="24 minutes total" icon={<Clock3 />} accent />
      <StatCard label="Early exits" value="02" note="43 minutes total" icon={<TimerOff />} />
    </div>
    <div className="dashboard-attendance-link employee"><div><span>TODAYâ€™S ATTENDANCE</span><b>Present Â· 9.23 hours</b><small>Shift 09:30 â€” 18:30 Â· Grace until 09:35</small></div><Link href="/employee/attendance">View attendance <ArrowRight size={17}/></Link></div>
    <div className="dashboard-grid">
      <Section title="Your day" kicker="UPCOMING / SCHEDULE" action={<Link href="/employee/meetings">Full calendar</Link>}>
        <div className="day-list">{meetings.map((m, i) => <div key={m.id}><div className="day-date"><b>{new Date(m.date).getDate()}</b><span>{new Date(m.date).toLocaleDateString("en-US", { month: "short" })}</span></div><div className="day-line"><i className={i === 0 ? "active" : ""} /></div><div><b>{m.title}</b><span><CalendarDays size={14} /> {m.time.slice(0,5)} Â· {m.location}</span></div><Badge>{m.department}</Badge></div>)}</div>
      </Section>
      <Section title="Latest payslips" kicker="PRIVATE / DOCUMENTS" action={<Link href="/employee/salary-slips">View arcflumenx</Link>}>
        <div className="payslip-list">{salarySlips.map(s => <div key={s.id}><div className="doc-icon">PDF</div><div><b>{new Date(s.year, s.month - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</b><span>Net pay Â· â‚¹{Number(s.net_salary).toLocaleString("en-IN")}</span></div><button><Download size={18} /></button></div>)}</div>
      </Section>
    </div>
    <Section title="From the noticeboard" kicker="COMPANY / UPDATES" action={<Link href="/employee/announcements">See all</Link>}>
      <div className="notice-grid">{announcements.map((a, i) => <article key={a.id}><span>0{i + 1} / {a.priority.toUpperCase()}</span><h3>{a.title}</h3><p>{a.message}</p><time>{new Date(a.date).toLocaleDateString("en-IN", { day: "2-digit", month: "long" })}</time></article>)}</div>
    </Section>
  </>;
}

