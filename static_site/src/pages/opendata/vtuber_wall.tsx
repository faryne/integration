import { useEffect, useMemo } from "react";

import { useVtuberLives } from "@/apis/opendata/vtubers.ts";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { liveStartAt, liveWallVideo } from "@/components/vtuber/format.ts";
import { useVtuberSnack } from "@/components/vtuber/useVtuberSnack.ts";
import { VideoWall } from "@/components/vtuber/wall/VideoWall.tsx";
import { WallUnsupported } from "@/components/vtuber/wall/WallUnsupported.tsx";
import { isMobileUserAgent } from "@/helpers/device.ts";
import { useTitle } from "@/helpers/title.tsx";

/** /data/vtubers/wall 直播電視牆：手機（UA 判斷）不提供，只顯示提示 */
export function VtuberWall() {
  useTitle("直播電視牆｜VTuber 直播行事曆");
  return isMobileUserAgent() ? <WallUnsupported /> : <LiveWall />;
}

// 資料來源：目前直播中的場次，依開台時間由早到晚；每分鐘隨直播列表重抓
function LiveWall() {
  const lives = useVtuberLives();
  const { snack, showError, close } = useVtuberSnack();
  useEffect(() => {
    if (lives.error) showError(lives.error);
  }, [lives.error, showError]);

  const videos = useMemo(
    () =>
      (lives.data?.lives ?? [])
        .filter((l) => l.status === "live")
        .sort((a, b) => Date.parse(liveStartAt(a)) - Date.parse(liveStartAt(b)))
        .map(liveWallVideo),
    [lives.data],
  );

  return (
    <>
      <VideoWall title={"直播電視牆"} countLabel={"直播中"} videos={videos} />
      <CustomSnackbar
        open={snack.open}
        message={snack.message}
        severity={snack.severity}
        onClose={close}
      />
    </>
  );
}
