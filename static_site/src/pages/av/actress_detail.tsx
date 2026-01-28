import {ActressDetail} from "@/components/av/actress_detail.tsx";
import {useAVActressSearch} from "@/apis/av/actress_search.ts";
import {useParams} from "react-router-dom";
import {useAVVideoSearch} from "@/apis/av/video_search.ts";

export function AVActressDetail() {
    const p = useParams()
    const s = useAVActressSearch({name: p.name, page: 1}, !!p.name)
    const videoQuery = useAVVideoSearch({page: 1, actress: p.name}, !!p.name)

    return (
        <>
            <ActressDetail actress={s.data?.data?.data?.[0]} videos={videoQuery}/>
        </>
    )
}