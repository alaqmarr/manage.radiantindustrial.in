"use client"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from "recharts"

export function DashboardCharts({ data }: { data: any }) {
  const revenueData = data.chartData || []

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs h-96 flex flex-col">
        <h3 className="text-slate-800 font-bold text-sm mb-4">7-Day Sales Revenue Trend</h3>
        <div className="flex-1 w-full h-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="name"
                stroke="#64748b"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#64748b"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `₹${val}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#ffffff",
                  borderColor: "#e2e8f0",
                  borderRadius: "8px",
                  boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
                }}
                itemStyle={{ color: "#0f172a", fontWeight: 600 }}
              />
              <Line
                type="monotone"
                dataKey="sales"
                stroke="#ea580c"
                strokeWidth={3}
                dot={{ r: 3, fill: "#ea580c" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs h-96 flex flex-col">
        <h3 className="text-slate-800 font-bold text-sm mb-4">Sales vs PO Spend (Last 7 Days)</h3>
        <div className="flex-1 w-full h-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="name"
                stroke="#64748b"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#64748b"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `₹${val}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#ffffff",
                  borderColor: "#e2e8f0",
                  borderRadius: "8px",
                  boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
                }}
                cursor={{ fill: "#f1f5f9" }}
              />
              <Bar dataKey="sales" fill="#ea580c" radius={[4, 4, 0, 0]} name="Sales" />
              <Bar dataKey="purchases" fill="#334155" radius={[4, 4, 0, 0]} name="Purchases" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
