"use client";

/**
 * Eski `<Header />` çağrı yeri. Gezinme artık sol menü + üst şerit olarak
 * `app-shell.tsx` içinde; bu dosya yalnızca mevcut sayfaların importlarını
 * kırmadan yeni kabuğa bağlar. Yeni sayfalar doğrudan AppShell kullanır.
 */
export { default } from "./app-shell";
