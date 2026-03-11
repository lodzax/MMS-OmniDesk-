import React, { useMemo, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, LineChart, Line 
} from 'recharts';
import { Ticket, TicketCategory, TicketStatus, TicketPriority } from '../types';
import { 
  BarChart3, 
  PieChart as PieChartIcon, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Inbox,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  Loader2
} from 'lucide-react';
import { motion } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { GoogleGenAI, Type } from '@google/genai';

interface DashboardProps {
  tickets: Ticket[];
  onFilterStatus?: (status: TicketStatus | 'all') => void;
  onFilterPriority?: (priority: TicketPriority | 'all') => void;
  onFilterCategory?: (category: TicketCategory | 'all') => void;
  onViewList?: () => void;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export const Dashboard: React.FC<DashboardProps> = ({ 
  tickets, 
  onFilterStatus, 
  onFilterPriority, 
  onFilterCategory,
  onViewList
}) => {
  const [isGenerating, setIsGenerating] = useState(false);

  const metrics = useMemo(() => {
    const total = tickets.length;
    const completed = tickets.filter(t => t.status === 'completed').length;
    const acknowledged = tickets.filter(t => t.status === 'acknowledged').length;
    const pending = tickets.filter(t => t.status === 'open' || t.status === 'assigned').length;
    const escalated = tickets.filter(t => t.is_escalated).length;
    
    return { total, completed, acknowledged, pending, escalated };
  }, [tickets]);

  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {
      laptop: 0,
      connectivity: 0,
      printer: 0,
      software: 0,
      desktop: 0,
      other: 0
    };
    tickets.forEach(t => {
      counts[t.category] = (counts[t.category] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ 
      name: name.charAt(0).toUpperCase() + name.slice(1), 
      value 
    }));
  }, [tickets]);

  const priorityData = useMemo(() => {
    const counts: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    tickets.forEach(t => {
      counts[t.priority] = (counts[t.priority] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));
  }, [tickets]);

  const statusData = useMemo(() => {
    const counts: Record<string, number> = { open: 0, assigned: 0, completed: 0, acknowledged: 0 };
    tickets.forEach(t => {
      counts[t.status] = (counts[t.status] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));
  }, [tickets]);

  const timeData = useMemo(() => {
    // Group by date for the last 7 days
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    return last7Days.map(date => {
      const count = tickets.filter(t => t.created_at.startsWith(date)).length;
      return { date: date.split('-').slice(1).join('/'), count };
    });
  }, [tickets]);

  const generateReport = async () => {
    setIsGenerating(true);
    try {
      const doc = new jsPDF();
      const timestamp = new Date().toLocaleString();

      // Title
      doc.setFontSize(22);
      doc.setTextColor(99, 102, 241); // Indigo-500
      doc.text('OmniDesk System Report', 14, 22);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // Slate-500
      doc.text(`Generated on: ${timestamp}`, 14, 30);

      // Summary Section
      doc.setFontSize(16);
      doc.setTextColor(30, 41, 59); // Slate-800
      doc.text('Executive Summary', 14, 45);

      const summaryData = [
        ['Metric', 'Count'],
        ['Total Tickets', metrics.total.toString()],
        ['Pending Tickets', metrics.pending.toString()],
        ['Completed Tickets', metrics.completed.toString()],
        ['Acknowledged Tickets', metrics.acknowledged.toString()],
      ];

      autoTable(doc, {
        startY: 50,
        head: [summaryData[0]],
        body: summaryData.slice(1),
        theme: 'striped',
        headStyles: { fillColor: [99, 102, 241] },
      });

      // Status Distribution
      doc.text('Tickets by Status', 14, (doc as any).lastAutoTable.finalY + 15);
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [['Status', 'Count']],
        body: statusData.map(s => [s.name, s.value.toString()]),
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129] }, // Emerald-500
      });

      // Category Distribution
      doc.text('Tickets by Category', 14, (doc as any).lastAutoTable.finalY + 15);
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [['Category', 'Count']],
        body: categoryData.map(c => [c.name, c.value.toString()]),
        theme: 'grid',
        headStyles: { fillColor: [245, 158, 11] }, // Amber-500
      });

      // Monthly Distribution (Last 6 months)
      const monthlyData: Record<string, number> = {};
      tickets.forEach(t => {
        const date = new Date(t.created_at);
        const monthYear = date.toLocaleString('default', { month: 'long', year: 'numeric' });
        monthlyData[monthYear] = (monthlyData[monthYear] || 0) + 1;
      });

      doc.text('Monthly Submission Trend', 14, (doc as any).lastAutoTable.finalY + 15);
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [['Month', 'Tickets Submitted']],
        body: Object.entries(monthlyData).map(([month, count]) => [month, count.toString()]),
        theme: 'striped',
        headStyles: { fillColor: [139, 92, 246] }, // Violet-500
      });

      // AI Insights
      doc.addPage();
      doc.setFontSize(18);
      doc.setTextColor(30, 41, 59);
      doc.text('AI-Powered Insights & Activity Analysis', 14, 22);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text('Advanced analysis of ticket patterns and resolution workflows.', 14, 28);

      const ai = new GoogleGenAI({ apiKey: (process.env as any).GEMINI_API_KEY });
      const model = 'gemini-3-flash-preview';
      
      // Fetch recent activities for analysis
      const activitiesResponse = await fetch('/api/activities?limit=100');
      const recentActivities = await activitiesResponse.json();
      
      const activitySummary = recentActivities.map((a: any) => 
        `- [${a.ticket_title || 'Unknown Ticket'}] ${a.user_name} (${a.user_role}): ${a.action} - ${a.details}`
      ).join('\n');

      const ticketSummary = tickets.map(t => `- [${t.category}] ${t.title}: ${t.description.substring(0, 50)}...`).join('\n');
      
      const prompt = `
        As an IT Support Analyst, analyze the following ticket data and activity logs to provide 4 high-impact insights.
        
        Data Summary:
        Total Tickets: ${metrics.total}
        Categories: ${JSON.stringify(categoryData)}
        Statuses: ${JSON.stringify(statusData)}
        
        Recent Tickets:
        ${ticketSummary.substring(0, 1500)}
        
        Recent Activity Logs:
        ${activitySummary.substring(0, 1500)}
      `;

      const aiResponse = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              insights: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    impact: { type: Type.STRING, description: "High, Medium, or Low" },
                    category: { type: Type.STRING, description: "Efficiency, Technical, Process, or Resource" }
                  },
                  required: ["title", "description", "impact", "category"]
                }
              }
            },
            required: ["insights"]
          }
        }
      });

      const result = JSON.parse(aiResponse.text || '{"insights": []}');
      const insights = result.insights;
      
      let currentY = 40;
      
      insights.forEach((insight: any, index: number) => {
        // Draw card background
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.setFillColor(248, 250, 252); // slate-50
        doc.roundedRect(14, currentY, 182, 35, 3, 3, 'FD');
        
        // Impact Badge
        const impactColor = insight.impact.toLowerCase() === 'high' ? [239, 68, 68] : 
                           insight.impact.toLowerCase() === 'medium' ? [245, 158, 11] : [59, 130, 246];
        
        doc.setFillColor(impactColor[0], impactColor[1], impactColor[2]);
        doc.roundedRect(155, currentY + 5, 35, 6, 1, 1, 'F');
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text(`${insight.impact} IMPACT`, 172.5, currentY + 9, { align: 'center' });
        
        // Category Label
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(insight.category.toUpperCase(), 20, currentY + 9);
        
        // Title
        doc.setFontSize(12);
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'bold');
        doc.text(insight.title, 20, currentY + 18);
        
        // Description
        doc.setFontSize(10);
        doc.setTextColor(71, 85, 105);
        doc.setFont('helvetica', 'normal');
        const splitDesc = doc.splitTextToSize(insight.description, 170);
        doc.text(splitDesc, 20, currentY + 25);
        
        currentY += 42;
      });

      // Activity Summary Table
      if (recentActivities.length > 0) {
        doc.addPage();
        doc.setFontSize(16);
        doc.setTextColor(30, 41, 59);
        doc.text('Recent Resolution Activities', 14, 22);
        
        autoTable(doc, {
          startY: 30,
          head: [['Ticket', 'User', 'Action', 'Details', 'Date']],
          body: recentActivities.slice(0, 20).map((a: any) => [
            a.ticket_title || 'N/A',
            a.user_name || 'N/A',
            a.action,
            a.details.substring(0, 50) + (a.details.length > 50 ? '...' : ''),
            new Date(a.created_at).toLocaleDateString()
          ]),
          theme: 'striped',
          headStyles: { fillColor: [79, 70, 229] }, // Indigo-600
        });
      }

      // Save the PDF
      doc.save(`OmniDesk_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Failed to generate report:', error);
      alert('Failed to generate report. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleChartClick = (type: 'status' | 'priority' | 'category', value: string) => {
    const normalizedValue = value.toLowerCase();
    if (type === 'status' && onFilterStatus) onFilterStatus(normalizedValue as TicketStatus);
    if (type === 'priority' && onFilterPriority) onFilterPriority(normalizedValue as TicketPriority);
    if (type === 'category' && onFilterCategory) onFilterCategory(normalizedValue as TicketCategory);
    if (onViewList) onViewList();
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">System Analytics</h2>
          <p className="text-gray-500 dark:text-gray-400">Real-time overview of IT support performance and ticket distribution.</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={generateReport}
          disabled={isGenerating}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-semibold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed dark:shadow-none"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <FileText className="w-5 h-5" />
              Generate Report (PDF)
            </>
          )}
        </motion.button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          title="Total Submitted" 
          value={metrics.total} 
          icon={Inbox} 
          color="indigo" 
          trend="+12%" 
          trendUp={true}
        />
        <MetricCard 
          title="Total Pending" 
          value={metrics.pending} 
          icon={Clock} 
          color="amber" 
          trend="+5%" 
          trendUp={true}
        />
        <MetricCard 
          title="Total Completed" 
          value={metrics.completed} 
          icon={CheckCircle2} 
          color="emerald" 
          trend="+18%" 
          trendUp={true}
        />
        <MetricCard 
          title="Acknowledged" 
          value={metrics.acknowledged} 
          icon={AlertCircle} 
          color="blue" 
          trend="-2%" 
          trendUp={false}
        />
        <MetricCard 
          title="Escalated" 
          value={metrics.escalated} 
          icon={AlertCircle} 
          color="rose" 
          trend="+4%" 
          trendUp={true}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Ticket Volume Trend */}
        <ChartContainer title="Ticket Volume (Last 7 Days)" icon={TrendingUp}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timeData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-gray-100 dark:text-gray-800" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: 'var(--tooltip-bg, #fff)', color: 'var(--tooltip-text, #000)' }}
                itemStyle={{ color: 'var(--tooltip-text, #000)' }}
              />
              <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1' }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Tickets by Category */}
        <ChartContainer title="Distribution by Category" icon={PieChartIcon}>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                onClick={(data) => handleChartClick('category', data.name)}
                className="cursor-pointer"
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: 'var(--tooltip-bg, #fff)', color: 'var(--tooltip-text, #000)' }}
              />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Tickets by Priority */}
        <ChartContainer title="Priority Breakdown" icon={PieChartIcon}>
          <div className="flex flex-col md:flex-row items-center justify-around h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={priorityData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  onClick={(data) => handleChartClick('priority', data.name)}
                  className="cursor-pointer"
                >
                  {priorityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: 'var(--tooltip-bg, #fff)', color: 'var(--tooltip-text, #000)' }}
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartContainer>

        {/* Tickets by Status */}
        <ChartContainer title="Current Status Overview" icon={BarChart3}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={statusData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-gray-100 dark:text-gray-800" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
              <Tooltip 
                cursor={{ fill: 'currentColor', className: 'text-gray-50/50 dark:text-gray-800/50' }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: 'var(--tooltip-bg, #fff)', color: 'var(--tooltip-text, #000)' }}
              />
              <Bar 
                dataKey="value" 
                radius={[4, 4, 0, 0]} 
                barSize={40}
                onClick={(data) => handleChartClick('status', data.name)}
                className="cursor-pointer"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>
    </div>
  );
};

const MetricCard = ({ title, value, icon: Icon, color, trend, trendUp }: any) => {
  const colorClasses: any = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-900/30',
    amber: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/30',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/30',
    blue: 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/30',
    rose: 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-900/30',
  };

  return (
    <motion.div 
      whileHover={{ y: -4 }}
      className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm dark:bg-[#1C1C1E] dark:border-gray-800"
    >
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-2xl border ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${trendUp ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400'}`}>
          {trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {trend}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500 mb-1 dark:text-gray-400">{title}</p>
        <h3 className="text-3xl font-bold text-gray-900 dark:text-white">{value}</h3>
      </div>
    </motion.div>
  );
};

const ChartContainer = ({ title, icon: Icon, children }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm dark:bg-[#1C1C1E] dark:border-gray-800"
  >
    <div className="flex items-center gap-3 mb-6">
      <div className="p-2 bg-gray-50 rounded-xl border border-gray-100 dark:bg-gray-800 dark:border-gray-700">
        <Icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
      </div>
      <h3 className="font-bold text-gray-900 dark:text-white">{title}</h3>
    </div>
    {children}
  </motion.div>
);
