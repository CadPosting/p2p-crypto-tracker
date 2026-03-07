import { ReportView } from "@/components/reports/report-view";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Summarise and export your trading data by day or month
        </p>
      </div>

      <ReportView />
    </div>
  );
}
