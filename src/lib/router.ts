import { useCallback, useEffect, useState } from "react";

function normalizeRoute(pathname: string) {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const normalizedPath = pathname.replace(/\/$/, "") || "/";

  if (normalizedPath === basePath) {
    return "/";
  }

  if (normalizedPath.startsWith(basePath)) {
    return normalizedPath.slice(basePath.length) || "/";
  }

  return normalizedPath;
}

function getRoute() {
  const params = new URLSearchParams(window.location.search);
  const redirectParam = params.get("redirect");
  const pathname = redirectParam || window.location.pathname;

  return normalizeRoute(pathname);
}

const NAVIGATE_EVENT = "app:navigate";

// Call this instead of setting window.location / using a plain <a> click
// for in-app links. Updates the URL without reloading the page, so the
// QueryClient (and its cache) stays alive across navigation.
export function navigate(path: string) {
  if (path === window.location.pathname + window.location.search) return;
  window.history.pushState(null, "", path);
  window.dispatchEvent(new Event(NAVIGATE_EVENT));
}

// Drop-in replacement for reading the route directly — re-renders whenever
// the URL changes via back/forward (popstate) or navigate() above.
export function useRoute() {
  const [route, setRoute] = useState(getRoute);

  useEffect(() => {
    const onChange = () => setRoute(getRoute());
    window.addEventListener("popstate", onChange);
    window.addEventListener(NAVIGATE_EVENT, onChange);
    return () => {
      window.removeEventListener("popstate", onChange);
      window.removeEventListener(NAVIGATE_EVENT, onChange);
    };
  }, []);

  return route;
}

// Intercepts clicks on ordinary same-origin <a href="..."> tags anywhere in
// the app and routes them through navigate() instead of letting the browser
// do a full page load. Mount this once near the app root (see App.tsx).
// Skips: modified clicks (ctrl/cmd/shift/alt, middle-click), target="_blank",
// download links, hash-only links, and cross-origin links — all of those
// should still behave like normal browser navigation.
export function useLinkInterceptor() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as HTMLElement)?.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      let url: URL;
      try {
        url = new URL(href, window.location.origin);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;

      e.preventDefault();
      navigate(url.pathname + url.search);
    }

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
}

// Convenience hook if you'd rather call navigate() from an onClick handler
// than rely on link interception (e.g. programmatic redirects).
export function useNavigate() {
  return useCallback((path: string) => navigate(path), []);
}