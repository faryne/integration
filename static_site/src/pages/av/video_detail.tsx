import { useAVVideoSearch } from "@/apis/av/video_search.ts";
import { useParams } from "react-router-dom";
import { VideoDetail } from "@/components/av/video_detail.tsx";

export function AVVideoDetail() {
  const p = useParams();
  const v = useAVVideoSearch({ page: 1, no: p.no }, !!p.no);
  return <VideoDetail video={v.data?.data?.data?.[0]} />;
}
