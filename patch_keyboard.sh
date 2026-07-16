sed -i '/const handleKeyDown = (e: KeyboardEvent) => {/a\
        if (e.key === "Escape") {\
          const active = document.activeElement;\
          if (active && (active.tagName.toLowerCase() === "input" || active.tagName.toLowerCase() === "textarea")) {\
            (active as HTMLElement).blur();\
            return;\
          }\
          if (keyboardFocusedId) {\
            setKeyboardFocusedId(null);\
            return;\
          }\
        }\
' src/features/dashboard/DashboardView.tsx
