import { Stack } from "@mui/material";

import { AgeConfirmationGate } from "@/components/common/AgeConfirmation.tsx";
import { BirthdaySection } from "@/components/joyu/home/BirthdaySection.tsx";
import { FollowedActressesSection } from "@/components/joyu/home/FollowedActressesSection.tsx";
import { JoyuHero } from "@/components/joyu/home/JoyuHero.tsx";
import { JoyuAdSlot } from "@/components/joyu/promo/JoyuAdSlot.tsx";
import { LatestVideosSection } from "@/components/joyu/home/LatestVideosSection.tsx";
import { UpcomingSection } from "@/components/joyu/home/UpcomingSection.tsx";
import { NewActressesSection } from "@/components/joyu/home/NewActressesSection.tsx";
import { TopicsSection } from "@/components/joyu/home/TopicsSection.tsx";
import { useTitle } from "@/helpers/title.tsx";

/**
 * joyu.fyi 首頁（入口頁，P2）：你追蹤的女優新片（有追蹤才顯示）、統一搜尋、今天有新片的女優、近期生日、女優主題、最新上架影片。
 * 女優搜尋列表在 /actress。各區塊各自打 API，一區失敗不影響其他區
 */
export function JoyuHome() {
  // 空字串＝標題只顯示站名
  useTitle("");
  return (
    <AgeConfirmationGate
      description="joyu.fyi 包含成人內容與成人作品資料。請確認你已年滿 18 歲後再繼續瀏覽。"
      panelTitle="joyu.fyi 需要年齡確認"
    >
      <Stack spacing={3.5}>
        {/* 有追蹤女優的人才會出現（最近 7 天） */}
        <FollowedActressesSection />
        <JoyuHero />
        <NewActressesSection />
        {/* 版位兩格：今天有新片的女優之後、女優主題之後 */}
        <JoyuAdSlot placement="home-1" />
        <BirthdaySection />
        <TopicsSection />
        <JoyuAdSlot placement="home-2" />
        <UpcomingSection />
        <LatestVideosSection />
      </Stack>
    </AgeConfirmationGate>
  );
}
