import { Button } from "@/components/ui/button";
import { Palette } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState, useEffect } from "react";

const themes = [
  { id: "default", name: "Turquoise", color: "hsl(185 60% 50%)" },
  { id: "purple", name: "Purple Dream", color: "hsl(270 60% 60%)" },
  { id: "emerald", name: "Emerald Forest", color: "hsl(160 60% 50%)" },
  { id: "sunset", name: "Sunset Orange", color: "hsl(25 80% 55%)" },
  { id: "rose", name: "Rose Garden", color: "hsl(340 65% 55%)" },
  { id: "sky", name: "Sky Blue", color: "hsl(200 70% 55%)" },
];

export default function ThemeSwitcher() {
  const [currentTheme, setCurrentTheme] = useState("default");

  useEffect(() => {
    const savedTheme = localStorage.getItem("nexora-theme") || "default";
    setCurrentTheme(savedTheme);
    applyTheme(savedTheme);
  }, []);

  const applyTheme = (themeId: string) => {
    if (themeId === "default") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", themeId);
    }
  };

  const handleThemeChange = (themeId: string) => {
    setCurrentTheme(themeId);
    localStorage.setItem("nexora-theme", themeId);
    applyTheme(themeId);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="hover:bg-primary/10 transition-all hover:scale-110"
        >
          <Palette className="w-5 h-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-4" align="end">
        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-foreground/80 mb-3">Choose Theme</h3>
          <div className="grid grid-cols-2 gap-2">
            {themes.map((theme) => (
              <button
                key={theme.id}
                onClick={() => handleThemeChange(theme.id)}
                className={`p-3 rounded-lg border-2 transition-all hover:scale-105 ${
                  currentTheme === theme.id
                    ? "border-primary shadow-lg shadow-primary/20"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-full border-2 border-background"
                    style={{ backgroundColor: theme.color }}
                  />
                  <span className="text-sm font-medium">{theme.name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
