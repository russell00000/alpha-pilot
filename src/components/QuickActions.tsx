import { Plus, Search, LineChart, Bell, Wallet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

const actions = [
  { label: "Add Trade", icon: Plus, color: "text-success" },
  { label: "Research", icon: Search, color: "text-primary" },
  { label: "Analysis", icon: LineChart, color: "text-warning" },
  { label: "Alerts", icon: Bell, color: "text-destructive" },
  { label: "Portfolio", icon: Wallet, color: "text-primary" },
  { label: "Reports", icon: FileText, color: "text-muted-foreground" },
];

const QuickActions = () => {
  return (
    <div className="glass-card p-4">
      <h3 className="text-sm font-medium text-muted-foreground mb-3">Quick Actions</h3>
      <div className="grid grid-cols-3 gap-2">
        {actions.map((action, index) => (
          <Button
            key={action.label}
            variant="ghost"
            className="flex flex-col items-center gap-2 h-auto py-4 hover:bg-secondary/80"
          >
            <div className={`p-2 rounded-lg bg-secondary ${action.color}`}>
              <action.icon className="w-4 h-4" />
            </div>
            <span className="text-xs text-muted-foreground">{action.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
};

export default QuickActions;
