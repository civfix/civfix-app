import { DEFAULT_APPEARANCE_PREFERENCE } from "@civfix/ui/theme/schemes"

// Kept free of "use client": the server-rendered root layout inlines APPEARANCE_SCRIPT as a string, and a
// client module would hand it a client reference instead.
export const APPEARANCE_STORAGE_KEY = "civfix.appearance"

/** Runs before first paint so a stored dark preference never flashes the light scheme. */
export const APPEARANCE_SCRIPT = `(function(){try{
var s=localStorage.getItem(${JSON.stringify(APPEARANCE_STORAGE_KEY)});
if(s!=="light"&&s!=="dark"&&s!=="system")s=${JSON.stringify(DEFAULT_APPEARANCE_PREFERENCE)};
var d=s==="dark"||(s==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);
document.documentElement.classList.toggle("dark",d);
document.documentElement.style.colorScheme=d?"dark":"light";
}catch(e){}})();`
