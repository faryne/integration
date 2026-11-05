import { useState } from "react";

import { useSubmitCopyrightClaim } from "@/apis/nekomaid/copyrightClaim.ts";
import { apiErrorMessage } from "@/helpers/apiError.ts";
import { copyrightClaimPath } from "@/helpers/nekomaidForbidden.ts";

/** 表單狀態：email、說明都選填；website 是 honeypot（畫面上看不到，只有機器人會填） */
export function useCopyrightClaimForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [resultPath, setResultPath] = useState("");
  const [error, setError] = useState("");
  const mutation = useSubmitCopyrightClaim();

  return {
    email,
    setEmail,
    message,
    setMessage,
    website,
    setWebsite,
    /** 送出成功後的查詢網址（/copyright-claim/:hash）；空字串＝還沒送出 */
    resultPath,
    error,
    clearError: () => setError(""),
    pending: mutation.isPending,
    /** artworkId 空字串＝整個畫師 */
    submit: (site: string, authorId: string, artworkId = "") =>
      mutation.mutate(
        {
          site,
          author_id: authorId,
          artwork_id: artworkId,
          contact_email: email.trim(),
          message: message.trim(),
          website,
        },
        {
          onSuccess: (result) => setResultPath(copyrightClaimPath(result.hash)),
          onError: (e) => setError(apiErrorMessage(e, "送出失敗，請稍後再試")),
        },
      ),
    reset: () => {
      setEmail("");
      setMessage("");
      setWebsite("");
      setResultPath("");
    },
  };
}
