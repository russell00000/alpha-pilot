import { Plus, Search, LineChart, Bell, Wallet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const QuickActions = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const showComingSoon = (feature: string) => {
    toast({
      title: "Coming Soon",
      description: `${feature} feature will be available soon!`,
    });
  };

  const actions = [
    { label: "Add Trade", icon: Plus, color: "text-success", action: () => showComingSoon("Trade tracking") },
    { label: "Research", icon: Search, color: "text-primary", action: () => navigate("/markets") },
    { label: "Analysis", icon: LineChart, color: "text-warning", action: () => navigate("/chat") },
    { label: "Alerts", icon: Bell, color: "text-destructive", action: () => showComingSoon("Price alerts") },
    { label: "Portfolio", icon: Wallet, color: "text-primary", action: () => navigate("/portfolio") },
    { label: "Reports", icon: FileText, color: "text-muted-foreground", action: () => showComingSoon("Reports") },
  ];

  return (
    <div className="glass-card p-4">
      <h3 className="text-sm font-medium text-muted-foreground mb-3">Quick Actions</h3>
      <div className="grid grid-cols-3 gap-2">
        {actions.map((action) => (
          <Button
            key={action.label}
            variant="ghost"
            onClick={action.action}
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
