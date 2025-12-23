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
    { label: "Add Trade", icon: Plus, color: "from-success/20 to-success/5 text-success border-success/20", action: () => showComingSoon("Trade tracking") },
    { label: "Research", icon: Search, color: "from-primary/20 to-primary/5 text-primary border-primary/20", action: () => navigate("/markets") },
    { label: "Analysis", icon: LineChart, color: "from-warning/20 to-warning/5 text-warning border-warning/20", action: () => navigate("/chat") },
    { label: "Alerts", icon: Bell, color: "from-destructive/20 to-destructive/5 text-destructive border-destructive/20", action: () => showComingSoon("Price alerts") },
    { label: "Portfolio", icon: Wallet, color: "from-primary/20 to-primary/5 text-primary border-primary/20", action: () => navigate("/portfolio") },
    { label: "Reports", icon: FileText, color: "from-muted-foreground/20 to-muted-foreground/5 text-muted-foreground border-muted-foreground/20", action: () => showComingSoon("Reports") },
  ];

  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">Quick Actions</h3>
      <div className="grid grid-cols-3 gap-3">
        {actions.map((action) => (
          <Button
            key={action.label}
            variant="ghost"
            onClick={action.action}
            className="flex flex-col items-center gap-2.5 h-auto py-4 hover:bg-secondary/50 transition-all duration-200 group"
          >
            <div className={`p-2.5 rounded-xl bg-gradient-to-br ${action.color} border transition-all duration-200 group-hover:scale-110`}>
              <action.icon className="w-4 h-4" />
            </div>
            <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors duration-200">{action.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
};

export default QuickActions;