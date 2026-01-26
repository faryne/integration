import {useTitle} from "@/helpers/title.tsx"
import {useState} from "react"
import type {Actress} from "@/types/av.ts"
import {useAVActressSearch} from "@/apis/av/actress_search.ts"
import {Grid, Stack} from "@mui/material";

export function AVActress() {
    // eslint-disable-next-line react-hooks/purity
    const rnd: number = Math.random();
    const [r] = useState<number>(rnd)
    const [chosenA, setChosenA] = useState<Actress|null>(null)
    const s = useAVActressSearch({page: 1, random: r})
    useTitle("女優搜尋")
    return (
        <>
            <Grid container>
                {s.data?.data?.map(a => (
                    <Grid key={a.name} sx={{
                        margin: "5px",
                        clear: chosenA != null && chosenA.name === a.name? "both" : "none",
                        display: "block",
                        width: chosenA != null && chosenA.name === a.name ? "100%" : "auto",
                    }}>
                        <Stack direction={"row"} spacing={2}>
                            <img src={a.photo} alt={a.name} title={a.name} />
                        </Stack>
                    </Grid>
                ))}
            </Grid>
        </>
    )
}