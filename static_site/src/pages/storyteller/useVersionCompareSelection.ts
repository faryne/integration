import { useState } from "react";

// 編輯歷史「選兩個版本比對」的選取規則，StoryEditor／LoreEditor／SteamLoom Writer 共用：
// 右邊（新版本）必須比左邊（舊版本）新；換了左邊之後右邊不再合法就清掉，讓使用者重選。
// Writer 透過 alias 直接 import，這支檔案只能用相對路徑 import。
export function useVersionCompareSelection(
  items: { id: string; createdAt: string }[],
) {
  const [leftVersionId, setLeftVersionId] = useState("");
  const [rightVersionId, setRightVersionId] = useState("");
  const findItem = (id: string) => items.find((item) => item.id === id);
  // right 是否為 left 之後才建立的版本
  const isNewerThan = (
    right: { id: string; createdAt: string } | undefined,
    left: { id: string; createdAt: string } | undefined,
  ) =>
    Boolean(
      right &&
        left &&
        right.id !== left.id &&
        new Date(right.createdAt) > new Date(left.createdAt),
    );

  return {
    leftVersionId,
    rightVersionId,
    setRightVersionId,
    isRightVersionDisabled: (versionId: string) =>
      !isNewerThan(findItem(versionId), findItem(leftVersionId)),
    handleLeftVersionChange: (versionId: string) => {
      setLeftVersionId(versionId);
      if (!isNewerThan(findItem(rightVersionId), findItem(versionId))) {
        setRightVersionId("");
      }
    },
  };
}
