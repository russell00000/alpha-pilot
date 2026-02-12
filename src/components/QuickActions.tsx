import { Gamepad2, Search, LineChart, Bell, Wallet, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface QuickAction {
  label: string;
  icon: React.ElementType;
  action?: () => void;
  href?: string;
}

const QuickActions = () => {
  const navigate = useNavigate();

  const actions: QuickAction[] = [
    { 
      label: "Trade Game", 
      icon: Gamepad2, 
      href: "https://auth.investopedia.com/realms/investopedia/protocol/openid-connect/registrations?client_id=finance-simulator&redirect_uri=https%3A%2F%2Fwww.investopedia.com%2Fsimulator%2Fportfolio&state=2e788a37-4b3f-46a0-8e5c-2874afeaeee8&response_mode=fragment&response_type=code&scope=openid&nonce=79d63075-4037-4600-991a-277b5dcd715e&code_challenge=spzxiu4T1rpJYAMAyPsvTa_W5tb6NDaNnW8CIxPETOo&code_challenge_method=S256" 
    },
    { label: "Research", icon: Search, action: () => navigate("/markets") },
    { label: "Analysis", icon: LineChart, action: () => navigate("/chat") },
    { label: "Alerts", icon: Bell, action: () => navigate("/alerts") },
    { label: "Portfolio", icon: Wallet, action: () => navigate("/portfolio") },
    { label: "Reports", icon: FileText, href: "https://www.sec.gov/search-filings" },
  ];

  const handleAction = (action: QuickAction) => {
    if (action.href) {
      window.open(action.href, "_blank", "noopener,noreferrer");
    } else if (action.action) {
      action.action();
    }
  };

  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1">
      {actions.map((action) => (
        <button
          key={action.label}
          onClick={() => handleAction(action)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary/40 border border-border/30 hover:bg-secondary/70 hover:border-border/50 transition-all duration-200 whitespace-nowrap group"
        >
          <action.icon className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors duration-200" />
          <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors duration-200">{action.label}</span>
        </button>
      ))}
    </div>
  );
};

export default QuickActions;
