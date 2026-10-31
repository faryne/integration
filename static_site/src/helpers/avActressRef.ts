import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAVActressSearch } from "@/apis/av/actress_search.ts";
import type { Actress } from "@/types/av.ts";

/**
 * 女優頁網址的參數，指定是哪一位（同名女優才分得開）：
 * xcity_id／manual_id 直接指定；dmm_id 來自新影片的出演 chip，由後端查對照表 dmm_actress_maps。
 * 女優搜尋、影片搜尋 API 的參數名稱相同
 */
export interface ActressRef {
  xcity_id?: number;
  manual_id?: number;
  dmm_id?: string;
}

/** 這位女優自己的參數（xcity 或手動上稿） */
export const actressRefOf = (a: { domain: string; aid: number }): ActressRef =>
  a.domain === "manual" ? { manual_id: a.aid } : { xcity_id: a.aid };

/** 女優頁網址；站內連結一律帶上這位的參數，同名時才不會打開別人。suffix 例如 "/edit" */
export const actressPagePath = (
  name: string,
  target?: { domain: string; aid: number },
  suffix = "",
) => {
  const path = `/av/actress/${encodeURIComponent(name)}${suffix}`;
  if (!target) return path;
  const ref = actressRefOf(target);
  const [key, value] = Object.entries(ref)[0];
  return `${path}?${key}=${value}`;
};

/** 從網址讀出參數；一個都沒有就回 undefined */
export const readActressRef = (
  params: URLSearchParams,
): ActressRef | undefined => {
  const num = (key: string) => {
    const n = Number(params.get(key));
    return Number.isInteger(n) && n > 0 ? n : undefined;
  };
  const ref: ActressRef = {
    xcity_id: num("xcity_id"),
    manual_id: num("manual_id"),
    dmm_id: params.get("dmm_id")?.trim() || undefined,
  };
  return ref.xcity_id || ref.manual_id || ref.dmm_id ? ref : undefined;
};

/**
 * 女優頁／修改頁共用：依網址決定是哪一位。
 * - 有參數：照參數查（改名後也找得回來），名字跟網址不同就換成新名字的網址；
 *   對不到就退回照名字，網址拿掉參數；從 dmm_id 進來而名字也查不到時，轉到女優搜尋頁
 * - 沒參數（舊網址）：照名字查，同名排第一的那位
 * sameNames 是名字完全相同的所有人，給「可能同名的女優」切換用。
 * 網址上的名字也可以是別名（/av/actress/高坂保奈美）：本名沒人時開別名相符的那位，有參數時也不換成本名網址
 */
/** 名字是這位的本名或別名 */
export const isActressName = (a: Actress, name: string) =>
  a.name === name || !!a.aliases?.includes(name);

export function useRoutedActress(name: string, suffix = "") {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ref = readActressRef(searchParams);
  const byName = useAVActressSearch({ name, page: 1 }, name !== "");
  const byRef = useAVActressSearch({ ...ref, page: 1 }, !!ref);
  // 姓名搜尋是部分比對（「みずき」也會找到「志田みずき」），只留完全相符的
  const found = byName.data?.data?.data ?? [];
  const sameNames: Actress[] = found.filter((a) => a.name === name);
  const byNameActress =
    sameNames[0] ?? found.find((a) => isActressName(a, name));
  const refActress = byRef.data?.data?.data?.[0];
  const settled = byName.isSuccess && (!ref || byRef.isSuccess);
  const actress = ref
    ? byRef.isSuccess
      ? (refActress ?? byNameActress)
      : undefined
    : byNameActress;

  useEffect(() => {
    if (!ref || !settled) return;
    if (refActress && !isActressName(refActress, name)) {
      navigate(actressPagePath(refActress.name, refActress, suffix), {
        replace: true,
      });
    } else if (!refActress && byNameActress) {
      navigate(actressPagePath(name, undefined, suffix), { replace: true });
    } else if (!refActress && ref.dmm_id) {
      navigate(`/av/actress?name=${encodeURIComponent(name)}`, {
        replace: true,
      });
    }
    // ref 每次 render 都是新物件，改看網址字串
  }, [settled, refActress?.domain, refActress?.aid, searchParams.toString()]);

  return {
    actress,
    sameNames,
    // 從 dmm_id 進來會轉去搜尋頁，不顯示 404
    notFound: settled && !actress && !ref?.dmm_id,
  };
}
