import { TrendingUp, Bell, User, Menu, Settings, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { label: "Dashboard", href: "/" },
  { label: "Markets", href: "/markets" },
  { label: "Portfolio", href: "/portfolio" },
  { label: "Chat", href: "/chat" },
];

const Header = () => {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/30 bg-background/60 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 transition-all duration-300 group-hover:border-primary/40 group-hover:shadow-lg group-hover:shadow-primary/10">
            <TrendingUp className="w-5 h-5 text-primary transition-transform duration-300 group-hover:scale-110" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-lg font-bold tracking-tight text-foreground">InvestAI</h1>
            <p className="text-xs text-muted-foreground">AI Investing Copilot</p>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1 bg-secondary/30 p-1 rounded-xl border border-border/30">
          {navItems.map((item) => (
            <Link key={item.href} to={item.href}>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "text-muted-foreground hover:text-foreground transition-all duration-200 rounded-lg px-4",
                  location.pathname === item.href && "text-foreground bg-background/80 shadow-sm"
                )}
              >
                {item.label}
              </Button>
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="relative hover:bg-secondary/50 transition-colors duration-200"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full animate-pulse-glow" />
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="gap-2 hover:bg-secondary/50 transition-colors duration-200"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground hidden sm:block" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-popover/95 backdrop-blur-xl border-border/50">
              <DropdownMenuItem asChild>
                <Link to="/admin/philosophy" className="flex items-center gap-3 cursor-pointer">
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                    <Settings className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-medium">AI Philosophy</p>
                    <p className="text-xs text-muted-foreground">Customize AI behavior</p>
                  </div>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/auth" className="flex items-center gap-3 cursor-pointer">
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-medium">Account</p>
                    <p className="text-xs text-muted-foreground">Manage your profile</p>
                  </div>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile Menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className="hover:bg-secondary/50">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-background/95 backdrop-blur-xl border-border/30">
              <div className="flex items-center gap-3 mb-8 pt-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-bold">InvestAI</h2>
                  <p className="text-xs text-muted-foreground">AI Investing Copilot</p>
                </div>
              </div>
              <nav className="flex flex-col gap-1">
                {navItems.map((item) => (
                  <Link 
                    key={item.href} 
                    to={item.href}
                    onClick={() => setMobileOpen(false)}
                  >
                    <Button
                      variant="ghost"
                      className={cn(
                        "w-full justify-start text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all duration-200",
                        location.pathname === item.href && "text-foreground bg-secondary"
                      )}
                    >
                      {item.label}
                    </Button>
                  </Link>
                ))}
                <div className="h-px bg-border/50 my-2" />
                <Link 
                  to="/admin/philosophy"
                  onClick={() => setMobileOpen(false)}
                >
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-start text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all duration-200",
                      location.pathname === "/admin/philosophy" && "text-foreground bg-secondary"
                    )}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    AI Settings
                  </Button>
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

export default Header;