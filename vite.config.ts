import { defineConfig } from "vite";

export default defineConfig(() => {
  // GitHub Pages serves from /<repo>/, so assets must be built with that base.
  // Locally (or non-Pages hosting), keep root base.
  const isPages = process.env.GITHUB_PAGES === "true";
  const repo = process.env.GITHUB_REPOSITORY?.split("/")?.[1];
  const base = isPages && repo ? `/${repo}/` : "/";

  return {
    base,
  };
});
