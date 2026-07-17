/**
 * SettingsView Debugging and Verification Script
 * This script runs diagnostics to verify that settings are correctly
 * synchronized between React state, localStorage, and document attributes (e.g., dark mode class).
 */

export interface DiagnosticItem {
  key: string;
  stateValue: any;
  storageValue: any;
  status: "MATCHED" | "MISALIGNED" | "MISSING";
  description: string;
}

export interface DiagnosticReport {
  timestamp: string;
  overallStatus: "PASS" | "FAIL";
  items: DiagnosticItem[];
  environment: {
    darkModeClassActive: boolean;
    userAgent: string;
  };
}

export const runSettingsDiagnostic = (state: {
  displayName: string;
  username: string;
  email: string;
  animationsEnabled: boolean;
  compactMode: boolean;
  theme: "light" | "dark" | undefined;
}): DiagnosticReport => {
  const items: DiagnosticItem[] = [];

  // 1. Verify Theme
  const storageTheme = localStorage.getItem("theme");
  const isDarkModeClass = document.documentElement.classList.contains("dark");
  let themeStatus: "MATCHED" | "MISALIGNED" | "MISSING" = "MATCHED";
  
  if (!storageTheme) {
    themeStatus = "MISSING";
  } else if (state.theme !== storageTheme || (state.theme === "dark" !== isDarkModeClass)) {
    themeStatus = "MISALIGNED";
  }
  
  items.push({
    key: "theme",
    stateValue: state.theme,
    storageValue: storageTheme,
    status: themeStatus,
    description: `Verifies if active theme is saved in localStorage and dark mode class "${isDarkModeClass ? "dark" : ""}" matches document root.`,
  });

  // 2. Verify Animations
  const storageAnimations = localStorage.getItem("instasorter_animations");
  let animationsStatus: "MATCHED" | "MISALIGNED" | "MISSING" = "MATCHED";
  
  if (storageAnimations === null) {
    animationsStatus = "MISSING";
  } else {
    const expectedBool = storageAnimations !== "false";
    if (state.animationsEnabled !== expectedBool) {
      animationsStatus = "MISALIGNED";
    }
  }
  
  items.push({
    key: "instasorter_animations",
    stateValue: state.animationsEnabled,
    storageValue: storageAnimations,
    status: animationsStatus,
    description: "Verifies hardware acceleration / smooth animations state.",
  });

  // 3. Verify Compact Mode
  const storageCompact = localStorage.getItem("instasorter_compact");
  let compactStatus: "MATCHED" | "MISALIGNED" | "MISSING" = "MATCHED";
  
  if (storageCompact === null) {
    compactStatus = "MISSING";
  } else {
    const expectedBool = storageCompact === "true";
    if (state.compactMode !== expectedBool) {
      compactStatus = "MISALIGNED";
    }
  }
  
  items.push({
    key: "instasorter_compact",
    stateValue: state.compactMode,
    storageValue: storageCompact,
    status: compactStatus,
    description: "Verifies compact list and bento-grid catalog visual density preference.",
  });

  // 4. Verify Display Name
  const storageDisplayName = localStorage.getItem("instasorter_displayName");
  let displayNameStatus: "MATCHED" | "MISALIGNED" | "MISSING" = "MATCHED";
  
  if (storageDisplayName === null) {
    displayNameStatus = "MISSING";
  } else if (state.displayName !== storageDisplayName) {
    displayNameStatus = "MISALIGNED";
  }
  
  items.push({
    key: "instasorter_displayName",
    stateValue: state.displayName,
    storageValue: storageDisplayName,
    status: displayNameStatus,
    description: "Verifies curator profile display name matches browser cache.",
  });

  // 5. Verify Username
  const storageUsername = localStorage.getItem("instasorter_username");
  let usernameStatus: "MATCHED" | "MISALIGNED" | "MISSING" = "MATCHED";
  
  if (storageUsername === null) {
    usernameStatus = "MISSING";
  } else if (state.username !== storageUsername) {
    usernameStatus = "MISALIGNED";
  }
  
  items.push({
    key: "instasorter_username",
    stateValue: state.username,
    storageValue: storageUsername,
    status: usernameStatus,
    description: "Verifies default Instagram creator archive handle.",
  });

  // 6. Verify Email
  const storageEmail = localStorage.getItem("instasorter_email");
  let emailStatus: "MATCHED" | "MISALIGNED" | "MISSING" = "MATCHED";
  
  if (storageEmail === null) {
    emailStatus = "MISSING";
  } else if (state.email !== storageEmail) {
    emailStatus = "MISALIGNED";
  }
  
  items.push({
    key: "instasorter_email",
    stateValue: state.email,
    storageValue: storageEmail,
    status: emailStatus,
    description: "Verifies curator notification and sync email address.",
  });

  const overallStatus = items.some(item => item.status === "MISALIGNED") ? "FAIL" : "PASS";

  return {
    timestamp: new Date().toISOString(),
    overallStatus,
    items,
    environment: {
      darkModeClassActive: isDarkModeClass,
      userAgent: navigator.userAgent,
    },
  };
};
