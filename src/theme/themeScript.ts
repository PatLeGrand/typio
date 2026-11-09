import { DARK_COLOR_SCHEME_QUERY, THEME_STORAGE_KEY, THEME_COLORS } from "./theme";

/**
 * Script exécuté dans le `<head>` avant le premier rendu : il pose la classe
 * `dark` sur `<html>` pour éviter tout flash. Il doit rester autonome (il est
 * injecté tel quel) et refléter `resolveEffectiveTheme` ; chaque accès au
 * navigateur est protégé car `localStorage` peut lever une exception.
 */
export const themeInitScript = `(function(){var p=null;try{p=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})}catch(e){}var d=false;try{d=p==="dark"||(p!=="light"&&matchMedia(${JSON.stringify(DARK_COLOR_SCHEME_QUERY)}).matches)}catch(e){}document.documentElement.classList.toggle("dark",d);try{var m=document.querySelector('meta[name="theme-color"]');if(!m){m=document.createElement("meta");m.setAttribute("name","theme-color");document.head.appendChild(m)}m.setAttribute("content",d?${JSON.stringify(THEME_COLORS.dark)}:${JSON.stringify(THEME_COLORS.light)})}catch(e){}})();`;
