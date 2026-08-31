import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { prisma } from "./db";

export const getStoreBySlug = cache(async (slug: string) => {
  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store) notFound();
  return store;
});
