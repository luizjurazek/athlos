export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "athlos-theme";

// Runs inline in <head> before first paint so a saved theme never flashes.
// Without a saved value, no data-theme is set and the OS preference applies.
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;}catch(e){}})();`;
