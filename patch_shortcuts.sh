sed -i '811a\
        // 1.5 Global shortcuts inside Dashboard View\
        if (e.key === "/") {\
          e.preventDefault();\
          const searchInput = document.getElementById("search-input");\
          if (searchInput) searchInput.focus();\
          return;\
        }\
        if (e.key === "Escape") {\
          const searchInput = document.getElementById("search-input");\
          if (document.activeElement === searchInput) {\
            searchInput.blur();\
            return;\
          }\
        }' src/features/dashboard/DashboardView.tsx
