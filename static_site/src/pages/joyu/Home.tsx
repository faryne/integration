import type { ReactNode } from "react";
import { Stack } from "@mui/material";

import { AgeConfirmationGate } from "@/components/common/AgeConfirmation.tsx";
import { BirthdaySection } from "@/components/joyu/home/BirthdaySection.tsx";
import { CompactHome } from "@/components/joyu/home/CompactHome.tsx";
import { FollowedActressesSection } from "@/components/joyu/home/FollowedActressesSection.tsx";
import { HomeLayoutSwitch } from "@/components/joyu/home/HomeLayoutSwitch.tsx";
import { useHomeLayout } from "@/components/joyu/home/homeLayout.ts";
import { JoyuHero } from "@/components/joyu/home/JoyuHero.tsx";
import { NewActressesSection } from "@/components/joyu/home/NewActressesSection.tsx";
import { NewVideosSection } from "@/components/joyu/home/NewVideosSection.tsx";
import { TopicsSection } from "@/components/joyu/home/TopicsSection.tsx";
import { JoyuAdSlot } from "@/components/joyu/promo/JoyuAdSlot.tsx";
import { useTitle } from "@/helpers/title.tsx";

/**
 * joyu.fyi 首頁（入口頁）：預設一屏版（CompactHome），右上角可切回原版面；選擇記在這台瀏覽器。
 * 女優搜尋列表在 /actress。各區塊各自打 API，一區失敗不影響其他區
 */
export function JoyuHome() {
  // 空字串＝標題只顯示站名
  useTitle("");
  const [layout, setLayout] = useHomeLayout();
  const switcher = <HomeLayoutSwitch layout={layout} onChange={setLayout} />;
  return (
    <AgeConfirmationGate
      description="joyu.fyi 包含成人內容與成人作品資料。請確認你已年滿 18 歲後再繼續瀏覽。"
      panelTitle="joyu.fyi 需要年齡確認"
    >
      {layout === "compact" ? (
        <CompactHome switcher={switcher} />
      ) : (
        <ClassicHome switcher={switcher} />
      )}
    </AgeConfirmationGate>
  );
}

/**
 * 原版面：你追蹤的女優新片（有追蹤才顯示）、統一搜尋、今天有新片的女優、近期生日、女優主題、新片（新上架＋即將發售）
 */
function ClassicHome({ switcher }: { switcher: ReactNode }) {
  return (
    <Stack spacing={3.5}>
      {switcher}
      {/* 有追蹤女優的人才會出現（最近 7 天） */}
      <FollowedActressesSection />
      <JoyuHero />
      <NewActressesSection />
      {/* 版位兩格：今天有新片的女優之後、女優主題之後 */}
      <JoyuAdSlot placement="home-1" />
      <BirthdaySection />
      <TopicsSection />
      <JoyuAdSlot placement="home-2" />
      {/* 新上架＋即將發售合在同一區，用分頁切換 */}
      <NewVideosSection />
    </Stack>
  );
}
