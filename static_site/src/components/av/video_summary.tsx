import type { Video } from "@/types/av.ts";
import {Box, ImageListItemBar} from "@mui/material";
import {useNavigate} from "react-router-dom";

export interface IVideoSummary {
  video: Video;
  onClick?: (v: Video) => void;
}
export function VideoSummary(props: IVideoSummary) {
    const navigate = useNavigate()
  return (
    <Box>
      <a href={"#"} onClick={(e) => {
          e.preventDefault()
          props.onClick?.(props.video)
      } }>
        <img
          src={props.video.thumb}
          alt={props.video.title}
          title={props.video.title}
          style={{ maxWidth: "120px" }}
        />
      </a>
        <ImageListItemBar
            title={props.video.title}
            subtitle={props.video.actresses.filter((a) => a !== "").join(" / ")}
            onClick={() => navigate(`/av/video/${props.video.maker_no ?? props.video.no}`)}
        ></ImageListItemBar>
    </Box>
  );
}
