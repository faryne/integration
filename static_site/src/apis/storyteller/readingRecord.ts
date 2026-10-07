import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import type { CommonResponse } from "@/apis/interfaces.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { apiBase, sessionHeaders } from "./shared.ts";

// 閱讀進度的對象種類；圖像作品也是 story。lore 等設定公開上線後才會開始記錄。
export type StorytellerReadingTargetType = "story" | "lore";

// 後端回傳的單筆閱讀進度：progress 是讀過的最遠位置（0～100、只增不減），
// completed_at 有值代表讀完，updated_at 是最後一次往前推進的時間（「繼續閱讀」用）。
export interface StorytellerReadingRecord {
  target_type: StorytellerReadingTargetType;
  target_public_id: string;
  progress: number;
  completed_at: string | null;
  updated_at: string;
}

export interface StorytellerReadingRecordInput {
  target_type: StorytellerReadingTargetType;
  target_public_id: string;
  progress: number;
}

export function storytellerReadingRecordsQueryKey(
  projectPublicId?: string,
  userId?: number,
) {
  return ["storyteller", "reading-records", projectPublicId, userId] as const;
}

const readingRecordsUrl = (projectPublicId: string) =>
  `${apiBase}/storyteller/story/${projectPublicId}/reading-records`;

// 登入讀者在這個作品的閱讀進度；未登入時不打 API，由 useReadingRecords 改讀 localStorage。
export function useStorytellerReadingRecords(projectPublicId?: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: storytellerReadingRecordsQueryKey(
      projectPublicId,
      session?.user.id,
    ),
    enabled: Boolean(session?.encrypt_key && projectPublicId),
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<StorytellerReadingRecord[]>
      >(readingRecordsUrl(projectPublicId!), {
        headers: sessionHeaders(session!.encrypt_key),
      });
      return response.data.data ?? [];
    },
  });
}

// 批次寫入進度，回傳寫入後的完整列表。平常走 axios（才吃得到 401 自動續期 session 的
// interceptor）；只有離開頁面時改用 fetch keepalive——瀏覽器會在分頁關閉後繼續把請求送完，
// axios 沒有這個選項。離開頁面那次拿不到回應也沒關係，下次打開作品會重新讀取。
export async function saveStorytellerReadingRecords(
  encryptKey: string,
  projectPublicId: string,
  records: StorytellerReadingRecordInput[],
) {
  const response = await axios.put<CommonResponse<StorytellerReadingRecord[]>>(
    readingRecordsUrl(projectPublicId),
    { records },
    { headers: sessionHeaders(encryptKey) },
  );
  return response.data.data ?? [];
}

export function beaconStorytellerReadingRecords(
  encryptKey: string,
  projectPublicId: string,
  records: StorytellerReadingRecordInput[],
) {
  void fetch(readingRecordsUrl(projectPublicId), {
    method: "PUT",
    keepalive: true,
    headers: {
      "Content-Type": "application/json",
      ...sessionHeaders(encryptKey),
    },
    body: JSON.stringify({ records }),
  }).catch(() => undefined);
}
