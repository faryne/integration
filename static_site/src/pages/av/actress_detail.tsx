import { ActressDetail } from "@/components/av/actress_detail.tsx";
import { useAVActressSearch } from "@/apis/av/actress_search.ts";
import { useParams } from "react-router-dom";
import { useAVVideoSearch } from "@/apis/av/video_search.ts";
import { useEffect, useState } from "react";

export function AVActressDetail() {
  const { name } = useParams<{ name: string }>();
  const [videoPage, setVideoPage] = useState(1);
  const s = useAVActressSearch({ name, page: 1 }, !!name);
  const videoQuery = useAVVideoSearch(
    { page: videoPage, actress: name },
    !!name,
  );

  useEffect(() => {
    setVideoPage(1);
  }, [name]);

  return (
    <>
      <ActressDetail
        actress={s.data?.data?.data?.[0]}
        onVideoPageChange={setVideoPage}
        videoPage={videoPage}
        videos={videoQuery}
      />
    </>
  );
}
