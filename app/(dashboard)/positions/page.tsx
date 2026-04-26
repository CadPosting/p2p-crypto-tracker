import { PositionsView } from "@/components/positions/positions-view";

export default function PositionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Positions &amp; P&amp;L
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Open inventory and realised profit by day
        </p>
      </div>
      <PositionsView />
    </div>
  );
}
