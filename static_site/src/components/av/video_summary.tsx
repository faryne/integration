import type { Video } from "@/types/av.ts";

export interface IVideoSummary {
  video: Video;
  onClick?: (v: Video) => void;
}
export function VideoSummary(props: IVideoSummary) {
  return (
    <>
      <a href={"#"} onClick={() => props.onClick?.(props.video)}>
        <img
          src={props.video.thumb}
          alt={props.video.title}
          title={props.video.title}
          style={{ maxWidth: "120px" }}
        />
      </a>
    </>
  );
}
