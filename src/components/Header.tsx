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
  { label: "Practice", href: "/practice" },
  { label: "Chat", href: "/chat" },
];

const Header = () => {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="container relative flex h-14 items-center justify-between px-4 md:px-6">
        {/* Logo - left */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 transition-all duration-200 group-hover:bg-primary/15">
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          <span className="hidden sm:block text-base font-semibold text-foreground">Vantage</span>
        </Link>

        {/* Desktop Nav - absolutely centered */}
        <nav className="hidden md:flex items-center absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="relative flex items-center bg-secondary/40 rounded-full p-1 border border-border/20">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link key={item.href} to={item.href}>
                  <button
                    className={cn(
                      "relative px-5 py-1.5 text-sm font-medium rounded-full transition-all duration-300 ease-out",
                      isActive
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground/80"
                    )}
                  >
                    {isActive && (
                      <span
                        className="absolute inset-0 rounded-full bg-secondary border border-border/40 shadow-sm"
                        style={{ animation: "scale-in 0.25s ease-out" }}
                      />
                    )}
                    <span className="relative z-10">{item.label}</span>
                  </button>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="flex items-center gap-1.5">
          <Button 
            variant="ghost" 
            size="icon" 
            className="relative h-8 w-8 hover:bg-secondary/60 transition-colors duration-200"
          >
            <Bell className="w-4 h-4 text-muted-foreground" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-primary rounded-full" />
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="gap-1.5 h-8 hover:bg-secondary/60 transition-colors duration-200"
              >
                <div className="w-6 h-6 rounded-md bg-secondary flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground hidden sm:block" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 bg-popover border-border/60">
              <DropdownMenuItem asChild>
                <Link to="/admin/philosophy" className="flex items-center gap-2.5 cursor-pointer">
                  <Settings className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">AI Philosophy</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border/50" />
              <DropdownMenuItem asChild>
                <Link to="/auth" className="flex items-center gap-2.5 cursor-pointer">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Account</span>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile Menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-secondary/60">
                <Menu className="w-4 h-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64 bg-background border-border/40">
              <div className="flex items-center gap-2.5 mb-6 pt-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-primary" />
                </div>
                <span className="font-semibold">Vantage</span>
              </div>
              <nav className="flex flex-col gap-0.5">
                {navItems.map((item) => (
                  <Link 
                    key={item.href} 
                    to={item.href}
                    onClick={() => setMobileOpen(false)}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "w-full justify-start text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors duration-200 h-9",
                        location.pathname === item.href && "text-foreground bg-secondary/60"
                      )}
                    >
                      {item.label}
                    </Button>
                  </Link>
                ))}
                <div className="h-px bg-border/40 my-2" />
                <Link 
                  to="/admin/philosophy"
                  onClick={() => setMobileOpen(false)}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "w-full justify-start text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors duration-200 h-9",
                      location.pathname === "/admin/philosophy" && "text-foreground bg-secondary/60"
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