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
    { label: "Add Trade", icon: Plus, action: () => showComingSoon("Trade tracking") },
    { label: "Research", icon: Search, action: () => navigate("/markets") },
    { label: "Analysis", icon: LineChart, action: () => navigate("/chat") },
    { label: "Alerts", icon: Bell, action: () => showComingSoon("Price alerts") },
    { label: "Portfolio", icon: Wallet, action: () => navigate("/portfolio") },
    { label: "Reports", icon: FileText, action: () => showComingSoon("Reports") },
  ];

  return (
    <div className="glass-card p-4">
      <h3 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Quick Actions</h3>
      <div className="grid grid-cols-3 gap-2">
        {actions.map((action) => (
          <Button
            key={action.label}
            variant="ghost"
            onClick={action.action}
            className="flex flex-col items-center gap-2 h-auto py-3 hover:bg-secondary/60 transition-colors duration-200 group"
          >
            <div className="p-2 rounded-lg bg-secondary/60 group-hover:bg-secondary transition-colors duration-200">
              <action.icon className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors duration-200" />
            </div>
            <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors duration-200">{action.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
};

export default QuickActions;