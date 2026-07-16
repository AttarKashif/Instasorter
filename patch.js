const fs = require('fs');
const code = fs.readFileSync('src/features/dashboard/DashboardView.tsx', 'utf8');

const replacement = `      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          const active = document.activeElement;
          if (active && (active.tagName.toLowerCase() === "input" || active.tagName.toLowerCase() === "textarea")) {
            (active as HTMLElement).blur();
            return;
          }
          if (keyboardFocusedId) {
            setKeyboardFocusedId(null);
            return;
          }
        }
        
        // 1. Ignore when typing in an input/textarea`;

const updated = code.replace(/      const handleKeyDown = \(e: KeyboardEvent\) => \{\s*\/\/\ 1\. Ignore when typing in an input\/textarea/m, replacement);
fs.writeFileSync('src/features/dashboard/DashboardView.tsx', updated);
