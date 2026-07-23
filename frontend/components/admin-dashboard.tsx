"use client";

import Link from "next/link";
import { ArrowRight, Clock3, TimerOff, UserCheck, UserX } from "lucide-react";
import { announcements, employees, leaves, meetings } from "@/lib/demo-data";
import { Avatar } from "./icons";
import { Badge, PageHeader, Section, StatCard } from "./ui";

export function AdminDashboard({ basePath = "/admin" }: { basePath?: "/admin" | "/hr" }) {
  const today = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "2-digit", month: "long" }).format(new Date());
  return <>
    <PageHeader eyebrow={`COMMAND CENTRE Â· ${today.toUpperCase()}`} title="Good morning." subtitle="Hereâ€™s the pulse of FLUMENX today." action={<Link className="text-action" href={`${basePath}/employees`}>View employees <ArrowRight size={17} /></Link>} />
    <div className="stats-grid">
      <StatCard label="Absent today" value="11" note="4 employees on leave" icon={<UserX />} />
      <StatCard label="Present today" value="132" note="89.2% attendance" icon={<UserCheck />} />
      <StatCard label="Late today" value="08" note="74 minutes combined" icon={<Clock3 />} accent />
      <StatCard label="Early exits" value="05" note="2 awaiting checkout" icon={<TimerOff />} />
    </div>
    <div className="dashboard-attendance-link"><div><span>ATTENDANCE CONTROL</span><b>09:30 â€” 18:30</b><small>5 minute grace period Â· 89.2% present today</small></div><Link href={`${basePath}/attendance`}>Open live register <ArrowRight size={17}/></Link></div>
    <div className="dashboard-grid">
      <Section title="People pulse" kicker="WORKFORCE / 30 DAYS" action={<span className="chart-legend"><i /> Active headcount</span>}>
        <div className="chart-wrap">
          <div className="chart-number"><strong>+12</strong><span>net growth</span></div>
          <svg viewBox="0 0 700 190" preserveAspectRatio="none" aria-label="Employee growth chart">
            <path className="grid-line" d="M0 25H700M0 80H700M0 135H700M0 188H700" />
            <path className="chart-line" d="M0 160 C55 154,75 132,125 138 S195 110,245 118 S315 76,365 91 S440 68,490 73 S555 42,610 56 S665 28,700 31" />
            {[["0","160"],["125","138"],["245","118"],["365","91"],["490","73"],["610","56"],["700","31"]].map(([x,y]) => <circle key={x} cx={x} cy={y} r="4" />)}
          </svg>
          <div className="chart-labels"><span>01 JUN</span><span>08 JUN</span><span>15 JUN</span><span>22 JUN</span><span>30 JUN</span></div>
        </div>
      </Section>
      <Section title="Up next" kicker="TODAY / SCHEDULE" action={<Link href={`${basePath}/meetings`}>View all</Link>}>
        <div className="schedule-list">{meetings.slice(0,3).map((m, i) => <div className="schedule-item" key={m.id}><div className="time-block"><b>{m.time.slice(0,5)}</b><span>{i ? "PM" : "AM"}</span></div><i className={i === 1 ? "amber" : ""} /><div><b>{m.title}</b><span>{m.location} Â· {m.department}</span></div></div>)}</div>
      </Section>
    </div>
    <div className="dashboard-grid lower">
      <Section title="Leave requests" kicker="NEEDS ATTENTION" action={<Link href={`${basePath}/leaves`}>Review all</Link>}>
        <div className="compact-table">{leaves.map(l => <div className="compact-row" key={l.id}><Avatar name={l.employee_name || ""} /><div className="grow"><b>{l.employee_name}</b><span>{l.leave_type} Â· {l.days} day{l.days === 1 ? "" : "s"}</span></div><div className="date-cell"><b>{new Date(l.start_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</b><span>START</span></div><Badge tone={l.status}>{l.status}</Badge></div>)}</div>
      </Section>
      <Section title="Latest updates" kicker="FLUMENX / NOTICEBOARD" action={<Link href={`${basePath}/announcements`}>Manage</Link>}>
        <div className="announcement-list">{announcements.map(a => <div key={a.id}><div className="announcement-index">{String(a.id).padStart(2, "0")}</div><div><b>{a.title}</b><p>{a.message}</p></div><Badge tone={a.priority}>{a.priority}</Badge></div>)}</div>
      </Section>
    </div>
    <div className="team-strip"><div><span>THE FLUMENX / NEWEST MEMBERS</span><h3>Fresh energy in the room.</h3></div><div className="member-stack">{employees.slice(0,5).map(e => <Avatar key={e.id} name={e.name} size={46} />)}<span>+7</span></div><Link href={`${basePath}/employees`}>Meet the team <ArrowRight size={17} /></Link></div>
  </>;
}

