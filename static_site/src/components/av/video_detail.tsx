import type { Video } from "@/types/av.ts";
import {
  Chip,
  ImageList,
  ImageListItem,
  Stack,
  Typography,
} from "@mui/material";

export interface IVideoDetail {
  video?: Video;
}

export function VideoDetail(props: IVideoDetail) {
  const video = props.video || null;
  const labels = video ? video.labels.filter((l) => l !== "") : [];
  const actresses = video ? video.actresses.filter((a) => a !== "") : [];
  const makers = video ? video?.makers.filter((m) => m !== "") : [];
  const series = video ? video.series.filter((s) => s !== "") : [];
  const directors = video ? video?.directors.filter((d) => d !== "") : [];
  return (
    <>
      <Stack direction={"column"} spacing={2}>
        <Typography variant={"h4"}>{props.video?.title}</Typography>
        <Typography variant={"body2"}>
          {props.video?.maker_no ?? "-"} / 發售日：{props.video?.vod_date ?? ""}
        </Typography>
        <Typography variant={"body2"}>
          發售商：{makers.length > 0 ? makers.join("") : "-"} / 品牌：
          {labels.length > 0 ? labels.join(" ") : "-"} / 系列：
          {series.length > 0 ? series.join(" / ") : "-"}
        </Typography>
        <Typography variant={"body2"}>
          出演：{actresses.length > 0 ? actresses.join(" / ") : "-"} / 監督：
          {directors.length > 0 ? directors.join(" / ") : "-"}
        </Typography>
        {props.video && <ImageList cols={4} rowHeight={120}>
          {props.video?.images.map((i) => (
            <ImageListItem key={i.thumb}>
              <img src={i.thumb} alt={props.video?.title} title={i.thumb} />
            </ImageListItem>
          ))}
        </ImageList>}
        <Typography variant={"body2"}>
          {props.video?.maker_no && (
            <Chip
              label={"View on missav"}
              onClick={() =>
                window.open(`https://missav.ws/${props.video?.maker_no}`)
              }
            ></Chip>
          )}
        </Typography>
      </Stack>
    </>
  );
}
