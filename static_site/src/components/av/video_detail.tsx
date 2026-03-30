import type { Video } from "@/types/av.ts";
import {
  Chip,
  ImageList,
  ImageListItem,
  Stack,
  Typography,
  Box,
} from "@mui/material";
import { useTitle } from "@/helpers/title.tsx";
import { useNavigate } from "react-router-dom";

export interface IVideoDetail {
  video?: Video;
}

export function VideoDetail(props: IVideoDetail) {
  const navigate = useNavigate();
  const video = props.video || null;
  const labels = video ? video.labels.filter((l) => l !== "") : [];
  const actresses = video ? video.actresses.filter((a) => a !== "") : [];
  const makers = video ? video?.makers.filter((m) => m !== "") : [];
  const series = video ? video.series.filter((s) => s !== "") : [];
  const directors = video ? video?.directors.filter((d) => d !== "") : [];

  useTitle(video?.title ?? "");

  const ChipClick = (s: string) => {
    navigate("/av/video?keyword=" + encodeURIComponent(s));
  };
  return (
    <>
      <Stack direction={"column"} spacing={2}>
        <Typography variant={"h4"}>{props.video?.title}</Typography>
        <Typography variant={"body2"}>
          {props.video?.maker_no ?? "-"} / 發售日：{props.video?.vod_date ?? ""}
        </Typography>
        <Box>
          發售商：
          {makers.length > 0
            ? makers.map((o) => (
                <Chip
                  component={"a"}
                  key={`maker-${o}`}
                  label={o}
                  clickable
                  onClick={() => ChipClick(o)}
                />
              ))
            : "-"}{" "}
          / 品牌：
          {labels.length > 0
            ? labels.map((o) => (
                <Chip
                  component={"a"}
                  key={`label-${o}`}
                  label={o}
                  clickable
                  onClick={() => ChipClick(o)}
                />
              ))
            : "-"}{" "}
          / 系列：
          {series.length > 0
            ? series.map((o) => (
                <Chip
                  component={"a"}
                  key={`series-${o}`}
                  label={o}
                  clickable
                  onClick={() => ChipClick(o)}
                />
              ))
            : "-"}
        </Box>
        <Box>
          出演：
          {actresses.length > 0
            ? actresses.map((o) => (
                <Chip
                  component={"a"}
                  key={`actress-${o}`}
                  label={o}
                  clickable
                  onClick={() => ChipClick(o)}
                />
              ))
            : "-"}{" "}
          / 監督：
          {directors.length > 0
            ? directors.map((o) => (
                <Chip
                  component={"a"}
                  key={`director-${o}`}
                  label={o}
                  clickable
                  onClick={() => ChipClick(o)}
                />
              ))
            : "-"}
        </Box>
        <Box>
          {props.video?.maker_no && (
            <Chip
              label={"View on missav"}
              onClick={() =>
                window.open(`https://missav.ws/${props.video?.maker_no}`)
              }
              clickable
            ></Chip>
          )}
        </Box>

        {props.video && (
          <ImageList cols={4} variant={"masonry"}>
            {props.video?.images.map((i) => (
              <ImageListItem key={i.thumb}>
                <img src={i.thumb} alt={props.video?.title} title={i.thumb} />
              </ImageListItem>
            ))}
          </ImageList>
        )}
      </Stack>
    </>
  );
}
