import {Header} from "@/components/common/Header.tsx"
import {Footer} from "@/components/common/Footer.tsx"
import { Outlet } from "react-router-dom"
import type {FC, ReactNode} from "react"
import "@/styles/common.css"
import {Container, Stack} from "@mui/material";

export interface DefaultLayoutProps {
    children?: React.ReactNode
}

export const DefaultLayout: FC<{ children?: ReactNode }> = () => {
    return (
        <Container maxWidth={"lg"}>
            <Stack direction={"column"}>
                <Header />
                <main><Outlet /></main>
                <Footer />
            </Stack>
        </Container>
    )
}