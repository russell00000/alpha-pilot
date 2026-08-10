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
    <div className="flex flex-wrap items-center justify-center gap-2.5 animate-stagger">
      {actions.map((action) => (
        <button
          key={action.label}
          onClick={() => handleAction(action)}
          className="group flex items-center gap-2.5 whitespace-nowrap rounded-full border border-border/80 bg-card/60 py-1.5 pl-1.5 pr-4 transition-[transform,border-color,background] duration-300 ease-out hover:-translate-y-0.5 hover:border-gold/30 hover:bg-card/90 active:scale-[0.98]"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-gold/15 bg-gold/[0.07] transition-colors duration-300 group-hover:border-gold/35 group-hover:bg-gold/[0.14]">
            <action.icon className="h-3.5 w-3.5 text-gold/80 transition-colors duration-200 group-hover:text-gold-light" strokeWidth={1.75} />
          </span>
          <span className="text-[13px] font-medium tracking-[0.01em] text-foreground/80 transition-colors duration-200 group-hover:text-foreground">
            {action.label}
          </span>
        </button>
      ))}
    </div>
  );
};

export default QuickActions;
