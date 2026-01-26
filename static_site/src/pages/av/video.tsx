import {useAVVideoSearch} from "@/apis/av/video_search"
import {Grid, Stack} from "@mui/material";
import {VideoSummary} from "@/components/av/video_summary.tsx";
import {useTitle} from "@/helpers/title.tsx";
import { useState} from "react";
import type {Video} from "@/types/av.ts";
import {VideoDetail} from "@/components/av/video_detail.tsx";
import {VideoSearch} from "@/components/av/video_search.tsx";


export function AVVideo() {
    // eslint-disable-next-line react-hooks/purity
    const rnd: number = Math.random();
    const [r] = useState<number>(rnd)
    const [chosenV, setChosenV] = useState<Video|null>(null)
    const s = useAVVideoSearch({page: 1, random: r})
    useTitle("影片搜尋")



  return (
      <>
          <Grid container spacing={4}>
              <Grid size={4}>
                  <VideoSearch onClick={(r) => console.log(r)} conditions={req}/>
              </Grid>
              <Grid size={8}>
                  <Grid container>
                      {s.data?.data?.map(v =>
                          <>
                              <Stack direction={"row"} spacing={4}>
                                  <VideoSummary video={v} onClick={(vid) => setChosenV(vid)} />
                                  {chosenV != null && chosenV.no === v.no && <VideoDetail video={chosenV} />}
                              </Stack>
                          </>
                      )}
                  </Grid>
              </Grid>
          </Grid>

      </>
  )
}