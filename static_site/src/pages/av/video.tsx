import {useAVVideoSearch} from "@/apis/av/video_search"
import {Grid, ImageList, ImageListItem, ImageListItemBar} from "@mui/material";
import {VideoSummary} from "@/components/av/video_summary.tsx";
import {useTitle} from "@/helpers/title.tsx";
import { useState} from "react";
import {VideoSearch} from "@/components/av/video_search.tsx";
import {useNavigate} from "react-router-dom";


export function AVVideo() {
    // eslint-disable-next-line react-hooks/purity
    const rnd: number = Math.random();
    const [r] = useState<number>(rnd)
    const s = useAVVideoSearch({page: 1, random: r})
    useTitle("影片搜尋")

    const navigate = useNavigate()



  return (
      <>
          <Grid container spacing={4}>
              <Grid size={4}>
                  <VideoSearch onClick={(r) => console.log(r)}/>
              </Grid>
              <Grid size={8}>
                  <ImageList cols={4}>
                      {s.data?.data?.length === 0 && <ImageListItem />}
                      {s.data?.data?.map(v =>
                          <ImageListItem key={v.maker_no ?? v.no} sx={{textAlign: "center"}}>
                              <VideoSummary video={v} onClick={(vid) => navigate(`/av/video/${vid.maker_no ?? vid.no}`)} />
                              <ImageListItemBar
                                  title={v.title}
                                  subtitle={v.actresses.filter(a => a !== "").join(" / ")}
                                  onClick={() => navigate(`/av/video/${v.maker_no ?? v.no}`)}
                              >
                              </ImageListItemBar>
                          </ImageListItem>
                      )}
                  </ImageList>
              </Grid>
          </Grid>

      </>
  )
}