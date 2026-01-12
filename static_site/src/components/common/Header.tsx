import {AppBar, Toolbar, Typography} from "@mui/material"
export function Header() {
    return (
        <>
            <AppBar position={"fixed"} sx={{
                maxWidth: 'lg',
                width: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                mx: 'auto'
            }}>
                <Toolbar>
                    <Typography>Faryne的實驗室</Typography>
                </Toolbar>
            </AppBar>
        </>
    )
}