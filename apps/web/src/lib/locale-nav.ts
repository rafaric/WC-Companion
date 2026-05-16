import { routing } from "@/i18n/routing";
import type { AppLocale } from "@/i18n/routing";

export { routing };
export type { AppLocale };

/**
 * Build a localized path given a locale and a path.
 * @example getLocalizedPath("es", "/dashboard") => "/es/dashboard"
 */
export function getLocalizedPath(locale: AppLocale, path: `/${string}`): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${cleanPath}`;
}

/**
 * Strip the locale prefix from a pathname.
 * @example stripLocalePrefix("/es/dashboard") => "/dashboard"
 */
export function stripLocalePrefix(pathname: string): string {
  const match = pathname.match(/^\/(en|es)(\/.*)?$/);
  return match ? match[2] ?? "/" : pathname;
}

/**
 * Extract the locale from a pathname.
 * @example getLocaleFromPathname("/es/dashboard") => "es" | null
 */
export function getLocaleFromPathname(pathname: string): AppLocale | null {
  const match = pathname.match(/^\/(en|es)(\/.*)?$/);
  return match ? (match[1] as AppLocale) : null;
}

/**
 * Check if a locale string is a valid AppLocale.
 */
export function isAppLocale(value: string | null | undefined): value is AppLocale {
  if (!value) return false;
  return (routing.locales as readonly string[]).includes(value);
}

/**
 * Get the default locale from routing config.
 */
export function getDefaultLocale(): AppLocale {
  return routing.defaultLocale as AppLocale;
}