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
    <div className="flex flex-wrap items-center justify-center gap-3 animate-stagger">
      {actions.map((action) => (
        <button
          key={action.label}
          onClick={() => handleAction(action)}
          className="luxe-sheen flex items-center gap-2.5 pl-2 pr-5 py-2 rounded-full luxe-glass hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-8px_rgba(0,0,0,0.6)] active:scale-[0.97] transition-all duration-500 ease-out whitespace-nowrap group"
        >
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-white/[0.08] group-hover:bg-white/[0.16] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition-colors duration-300">
            <action.icon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors duration-200" />
          </span>
          <span className="text-sm font-medium text-foreground/80 group-hover:text-foreground transition-colors duration-200">
            {action.label}
          </span>
        </button>
      ))}
    </div>
  );
};

export default QuickActions;
