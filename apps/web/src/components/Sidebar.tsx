import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { Box as BoxIcon, LayoutGrid, Settings } from "lucide-react";

const navigation = [
  { name: "Dashboard", to: "/", icon: LayoutGrid },
  { name: "Apps", to: "/apps", icon: BoxIcon },
  { name: "Settings", to: "/settings", icon: Settings },
];

export const Sidebar = () => {
  return (
    <div className="fixed inset-y-0 left-0 z-50 hidden w-64 border-r bg-background lg:block">
      <div className="flex h-14 items-center border-b px-6">
        <Link to="/" className="font-semibold">
          CodePush
        </Link>
      </div>
      <nav className="space-y-1.5 p-4">
        {navigation.map((item) => (
          <Link key={item.to} to={item.to} className="block">
            {({ isActive }) => (
              <Button
                variant={isActive ? "secondary" : "ghost"}
                className={cn("w-full justify-start")}
              >
                <item.icon className="mr-2 h-5 w-5" />
                {item.name}
              </Button>
            )}
          </Link>
        ))}
      </nav>
    </div>
  );
};
