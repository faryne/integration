import {useTitle} from "@/helpers/title.tsx"
import {useState} from "react"
import {useAVActressSearch} from "@/apis/av/actress_search.ts"
import {Box, Grid, ImageList, ImageListItem, ImageListItemBar} from "@mui/material"
import {ActressSummary} from "@/components/av/actress_summary.tsx"
import {useNavigate} from "react-router-dom"

export function AVActress() {
    // eslint-disable-next-line react-hooks/purity
    const rnd: number = Math.random();
    const [r] = useState<number>(rnd)
    const navigate = useNavigate()
    const s = useAVActressSearch({page: 1, random: r})
    useTitle("女優搜尋")

    const render3Size = (cup: string,b: number, w: number, h:number, height: number): string => {
        const body: string[] = []
        if (cup != "") {
            body.push(cup+" Cup")
        }
        if (b > 0) {
            body.push("B"+b)
        }
        if (w > 0) {
            body.push("W"+w)
        }
        if (h > 0) {
            body.push("H"+h)
        }
        if (height > 0) {
            body.push("身高："+height+"cm")
        }
        return body.join(" ")
    }
    return (
        <>
            <Grid container>
                <Grid size={4}>
                    <Box>aaa</Box>
                </Grid>
                <Grid size={8}>
                    <ImageList cols={4}>
                        {s.data?.data?.length === 0 && <ImageListItem />}
                        {s.data?.data?.map(a =>
                            <ImageListItem key={a.name} sx={{textAlign: "center"}}>
                                <ActressSummary actress={a} onClick={(a) => navigate(`/av/actress/${a.name}`)} />
                                <ImageListItemBar
                                    title={a.name}
                                    subtitle={render3Size(a.cup, a.bust, a.waist, a.hips, a.height)}
                                    onClick={() => navigate(`/av/actress/${a.name}`)}
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