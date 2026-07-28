import { TrendingUp, Bell, User, Menu, Settings, ChevronDown, LogOut, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { isOwner } from "@/lib/owner";
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
  { label: "Dashboard", href: "/", prefetch: () => import("@/pages/Index") },
  { label: "Markets", href: "/markets", prefetch: () => import("@/pages/Markets") },
  { label: "Screener", href: "/screener", prefetch: () => import("@/pages/Screener") },
  { label: "Portfolio", href: "/portfolio", prefetch: () => import("@/pages/Portfolio") },
  { label: "Analysis", href: "/analysis", prefetch: () => import("@/pages/PortfolioAnalysis") },
  { label: "Chat", href: "/chat", prefetch: () => import("@/pages/Chat") },
];

const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, signOut } = useAuth();
  const showPhilosophy = isOwner(user?.email);

  // Refs for sliding pill indicator
  const navRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [pill, setPill] = useState<{ left: number; width: number; visible: boolean }>({
    left: 0,
    width: 0,
    visible: false,
  });

  useLayoutEffect(() => {
    const el = itemRefs.current[location.pathname];
    const nav = navRef.current;
    if (el && nav) {
      const navRect = nav.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      setPill({ left: r.left - navRect.left, width: r.width, visible: true });
    } else {
      setPill((p) => ({ ...p, visible: false }));
    }
  }, [location.pathname]);

  // Prefetch all main routes on idle so the first navigation is instant
  useEffect(() => {
    const run = () => navItems.forEach((i) => i.prefetch?.());
    const w = window as any;
    if (typeof w.requestIdleCallback === "function") {
      const id = w.requestIdleCallback(run, { timeout: 1500 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = setTimeout(run, 400);
    return () => clearTimeout(t);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/25 backdrop-blur-md">
      <div className="container relative flex h-14 items-center justify-between px-4 md:px-6">
        {/* Logo - left */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-lg overflow-hidden">
            <span aria-hidden className="luxe-conic-ring absolute -inset-1 opacity-70 blur-[2px] rounded-lg" />
            <span aria-hidden className="absolute inset-[1.5px] rounded-[7px] bg-background" />
            <TrendingUp className="relative w-4 h-4 text-foreground" />
          </div>
          <span className="hidden sm:block text-base font-semibold tracking-tight luxe-shimmer-text">Vantage</span>
        </Link>

        {/* Desktop Nav - absolutely centered */}
        <nav className="hidden md:flex items-center absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div
            ref={navRef}
            className="relative flex items-center bg-secondary/40 rounded-full p-1 border border-border/20"
          >
            {/* Sliding active pill */}
            <span
              aria-hidden
              className={cn(
                "absolute top-1 bottom-1 rounded-full bg-secondary border border-border/40 shadow-sm",
                "transition-[transform,width,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform",
                pill.visible ? "opacity-100" : "opacity-0"
              )}
              style={{
                width: pill.width,
                transform: `translateX(${pill.left}px)`,
              }}
            />
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  ref={(el) => (itemRefs.current[item.href] = el)}
                  onMouseEnter={() => item.prefetch?.()}
                  onFocus={() => item.prefetch?.()}
                  className="relative"
                >
                  <button
                    className={cn(
                      "relative px-5 py-1.5 text-sm font-medium rounded-full transition-colors duration-200 ease-out",
                      isActive
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground/90"
                    )}
                  >
                    <span className="relative z-10">{item.label}</span>
                  </button>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="flex items-center gap-1.5">
          <Link to="/alerts" aria-label="Price alerts">
            <Button
              variant="ghost"
              size="icon"
              className="relative h-8 w-8 hover:bg-secondary/60 transition-colors duration-200"
            >
              <Bell className="w-4 h-4 text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-primary rounded-full" />
            </Button>
          </Link>
          
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
              {user && (
                <div className="px-3 py-2 text-xs text-muted-foreground truncate border-b border-border/40 mb-1">
                  {user.email}
                </div>
              )}
              {showPhilosophy && (
                <>
                  <DropdownMenuItem asChild>
                    <Link to="/admin/philosophy" className="flex items-center gap-2.5 cursor-pointer">
                      <Settings className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">AI Philosophy</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-border/50" />
                </>
              )}
              {user ? (
                <DropdownMenuItem onClick={handleSignOut} className="flex items-center gap-2.5 cursor-pointer text-red-500 focus:text-red-500">
                  <LogOut className="w-4 h-4" />
                  <span className="text-sm">Sign Out</span>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem asChild>
                  <Link to="/auth" className="flex items-center gap-2.5 cursor-pointer">
                    <LogIn className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Sign In</span>
                  </Link>
                </DropdownMenuItem>
              )}
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
                {showPhilosophy && (
                  <>
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
                  </>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

export default Header;