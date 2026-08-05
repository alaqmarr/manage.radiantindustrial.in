"use client"
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar
} from 'recharts'

export function DashboardCharts({ data }: { data: any }) {
  // Placeholder data for now, ideally we pass down real time-series data
  const revenueData = [
    { name: 'Mon', sales: 4000, purchases: 2400 },
    { name: 'Tue', sales: 3000, purchases: 1398 },
    { name: 'Wed', sales: 2000, purchases: 9800 },
    { name: 'Thu', sales: 2780, purchases: 3908 },
    { name: 'Fri', sales: 1890, purchases: 4800 },
    { name: 'Sat', sales: 2390, purchases: 3800 },
    { name: 'Sun', sales: 3490, purchases: 4300 },
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
      <div className="glass-panel rounded-2xl p-6 h-96 flex flex-col">
        <h3 className="text-zinc-200 font-medium mb-6">Revenue Trend</h3>
        <div className="flex-1 w-full h-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="name" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val/1000}k`} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }}
                itemStyle={{ color: '#e4e4e7' }}
              />
              <Line type="monotone" dataKey="sales" stroke="#f48c36" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-6 h-96 flex flex-col">
        <h3 className="text-zinc-200 font-medium mb-6">Purchases vs Sales</h3>
        <div className="flex-1 w-full h-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="name" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val/1000}k`} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }}
                cursor={{ fill: '#27272a', opacity: 0.4 }}
              />
              <Bar dataKey="sales" fill="#f48c36" radius={[4, 4, 0, 0]} />
              <Bar dataKey="purchases" fill="#556270" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
