import {
  useAVVideoSearch,
  type VideoSearchRequest,
} from "@/apis/av/video_search";
import { Grid, ImageListItemBar, Box } from "@mui/material";
import { VideoSummary } from "@/components/av/video_summary";
import { useTitle } from "@/helpers/title";
import { useState } from "react";
import { VideoSearch } from "@/components/av/video_search";
import { useNavigate } from "react-router-dom";
import type { ListByPaginationRequest } from "@/apis/interfaces";
import { CustomImageList } from "@/components/common/CustomImageList";
import type { Video } from "@/types/av.ts";
import { CustomLoading } from "@/components/common/CustomLoading.tsx";

export function AVVideo() {
  const [search, setSearch] = useState<
    ListByPaginationRequest<VideoSearchRequest>
  >({
    page: 1,
  });
  const s = useAVVideoSearch(search);
  useTitle("影片搜尋");

  const navigate = useNavigate();

  return (
    <>
      <Grid container spacing={4}>
        <Grid size={4}>
          <VideoSearch onClick={(r) => setSearch((o) => ({ ...o, ...r }))} />
        </Grid>
        <Grid size={8}>
          {(s.isLoading || s.isPending) && <CustomLoading />}
          {!s.isLoading && s.isSuccess && (
            <CustomImageList<Video>
              rows={s.data?.data?.data ?? []}
              total={s.data?.data?.total ?? 0}
              per_page={s.data?.data?.per_page ?? 0}
              current_page={search.page}
              keyItemFunc={(v) => v.maker_no ?? v.no}
              renderItemFunc={(v) => (
                <Box>
                  <VideoSummary
                    video={v}
                    onClick={(vid) =>
                      navigate(
                        `/av/video/${vid.maker_no && vid.maker_no !== "" ? vid.maker_no : vid.no}`,
                      )
                    }
                  />
                  <ImageListItemBar
                    title={v.title}
                    subtitle={v.actresses.filter((a) => a !== "").join(" / ")}
                    onClick={() =>
                      navigate(
                        `/av/video/${v.maker_no && v.maker_no !== "" ? v.maker_no : v.no}`,
                      )
                    }
                  ></ImageListItemBar>
                </Box>
              )}
              onPaginationChange={(p) => setSearch((o) => ({ ...o, page: p }))}
            />
          )}
        </Grid>
      </Grid>
    </>
  );
}
