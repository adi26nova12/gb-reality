"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const axis = { fontSize: 11, fill: "var(--muted-foreground)" };

export function EngagementOverTime({ data }: { data: { date: string; visits: number; events: number }[] }) {
  const rows = data.map((d) => ({ ...d, label: new Date(`${d.date}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }) }));
  return (
    <div className="h-72 w-full" role="img" aria-label="Line chart of microsite visits and engagement events per day">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="visits" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Area type="monotone" dataKey="events" name="Events" stroke="var(--chart-2)" fill="none" strokeWidth={1.5} strokeDasharray="4 3" />
          <Area type="monotone" dataKey="visits" name="Visits (sessions)" stroke="var(--chart-1)" fill="url(#visits)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ByDevelopment({ data }: { data: { name: string; visits: number; events: number; viewingRequests: number }[] }) {
  return (
    <div className="h-72 w-full" role="img" aria-label="Bar chart of engagement by development">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" horizontal={false} />
          <XAxis type="number" tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="name" tick={axis} tickLine={false} axisLine={false} width={120} />
          <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }} cursor={{ fill: "var(--muted)" }} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="visits" name="Visits" fill="var(--chart-1)" radius={[0, 4, 4, 0]} barSize={10} />
          <Bar dataKey="viewingRequests" name="Viewing requests" fill="var(--chart-2)" radius={[0, 4, 4, 0]} barSize={10} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
