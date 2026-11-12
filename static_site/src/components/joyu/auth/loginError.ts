// joyu Google 登入失敗時要提示的錯誤；使用者自己關掉彈窗不算錯（回空字串）。頁首帳號區、股市的登入按鈕共用
export const loginErrorMessage = (e: unknown) => {
  const code = (e as { code?: string })?.code ?? "";
  if (
    code === "auth/popup-closed-by-user" ||
    code === "auth/cancelled-popup-request"
  )
    return "";
  if (code === "auth/popup-blocked")
    return "登入視窗被瀏覽器擋下了，請允許彈出視窗後再試一次";
  return "登入失敗，請稍後再試";
};
