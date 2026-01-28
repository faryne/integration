import type {Actress} from "@/types/av.ts";
import {Card, CardContent, CardHeader, Grid, ImageListItemBar, Stack, Typography} from "@mui/material";
import type {UseQueryResult} from "@tanstack/react-query";
import type {VideoSearchResponse} from "@/apis/av/video_search.ts";
import {VideoSummary} from "@/components/av/video_summary.tsx";
import {CustomImageList} from "@/components/common/CustomImageList.tsx";
import {useNavigate} from "react-router-dom";

export interface IActressDetail {
    actress?: Actress
    videos?: UseQueryResult<VideoSearchResponse, Error>
}

export function ActressDetail(props: IActressDetail) {
    const actress = props.actress ?? null
    const navigate = useNavigate()
    return (
        <>
            {actress && (
                <Grid container>
                    <Grid size={3}>
                        <Card sx={{maxWidth: 345}}>
                            <CardHeader title={actress.name} subheader={actress.kana} avatar={<img src={actress.photo} alt={actress.name} title={actress.name} />}/>
                            <CardContent>
                                <Stack direction={"column"} spacing={2}>
                                    <Typography variant={"body1"}>三圍：{actress.bust + (actress.cup ?? "") + " / " + actress.waist + " / " + actress.hips}</Typography>
                                    <Typography variant={"body1"}>生日：{actress.birth_year+"/"+actress.birth_month+"/"+actress.birth_day}</Typography>
                                    {actress.height > 0 && <Typography variant={"body1"}>身高：{actress.height +" cm"}</Typography>}
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid size={1}></Grid>
                    <Grid size={8}>
                        <CustomImageList
                            rows={props.videos?.data?.data?.data ?? []}
                            total={props.videos?.data?.data?.total ?? 0}
                            per_page={props.videos?.data?.data?.per_page ?? 0}
                            current_page={1}
                            keyItemFunc={(v) => v.maker_no ?? v.no}
                            renderItemFunc={(v) => (
                                <>
                                    <VideoSummary
                                        video={v}
                                        onClick={(vid) =>
                                            navigate(`/av/video/${vid.maker_no ?? vid.no}`)
                                        }
                                    />
                                    <ImageListItemBar
                                        title={v.title}
                                        subtitle={v.actresses.filter((a) => a !== "").join(" / ")}
                                        onClick={() => navigate(`/av/video/${v.maker_no ?? v.no}`)}
                                    ></ImageListItemBar>
                                </>
                            )}
                            onPaginationChange={(p) => console.log(p)}
                        />
                    </Grid>
                </Grid>
            )}
        </>
    )
}