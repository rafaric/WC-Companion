import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "es"],
  defaultLocale: "en",
  localePrefix: "always",
});

export const LOCALES = routing.locales;
export type AppLocale = (typeof LOCALES)[number];

export function isValidLocale(locale: string): locale is AppLocale {
  return (routing.locales as readonly string[]).includes(locale);
}