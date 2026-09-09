"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_STAFF_LABEL } from "@/lib/labels";

/**
 * 직원 호칭을 클라이언트 컴포넌트에 내려주는 컨텍스트.
 * 매장 레이아웃이 한 번 감싸면 그 아래 어디서든 useStaffLabel() 로 읽는다.
 * 서버 컴포넌트는 store.staffLabel 을 바로 쓰면 된다.
 */
const Ctx = createContext<string>(DEFAULT_STAFF_LABEL);

export function StoreLabelProvider({ staffLabel, children }: { staffLabel: string; children: ReactNode }) {
  return <Ctx.Provider value={staffLabel || DEFAULT_STAFF_LABEL}>{children}</Ctx.Provider>;
}

export const useStaffLabel = () => useContext(Ctx);
