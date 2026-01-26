import type {Video} from "@/types/av.ts";
import {Stack} from "@mui/material";

export interface IVideoSummary {
    video: Video,
    onClick?: (v: Video) => void
}
export function VideoSummary(props: IVideoSummary) {
    return  (
        <>
            <Stack direction={"column"} spacing={4}>
                <img
                    src={props.video.thumb}
                    alt={props.video.title}
                    title={props.video.title}
                    style={{maxWidth: "120px"}}
                    onClick={() => props.onClick?.(props.video)}
                />
                {/*<Typography variant={"body2"}>{props.video.title}</Typography>*/}
            </Stack>
        </>
    )
}