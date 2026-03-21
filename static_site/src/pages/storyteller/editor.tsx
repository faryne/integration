import MdEditor, {type FunctionPlugin, Plugins} from 'react-markdown-editor-lite'
import Markdown from "react-markdown"
import {Tabs, Tab, Box, Grid} from "@mui/material"
import {useEffect, useState} from "react";
import 'react-markdown-editor-lite/lib/index.css';
import "react-chat-elements/dist/main.css"
import { MessageBox } from "react-chat-elements";
import dayjs from "dayjs";



const EditorAction = {
    Editor: "editor",
    History: "history"
} as const;

type EditActionType = typeof EditorAction[keyof typeof EditorAction];

interface IChatPluginConfig {
    open: boolean
    onClick: (open: boolean) => void
}
const ChatPlugin: FunctionPlugin<IChatPluginConfig> = (props) => {
    const [openState, setOpenState] = useState<boolean>(props.config.open)

    useEffect(() => {
        props.config.onClick(openState)
    }, [openState])

    return (
        <span
            className="button button-type-counter"
            title="Counter"
            onClick={() => setOpenState(!openState)}
        >
            A
        </span>
    )
}
ChatPlugin.pluginName = "Chat"
ChatPlugin.displayName = "Chat"
ChatPlugin.align = "left"


export function Editor() {
    const [action, setAction] = useState<EditActionType>(EditorAction.Editor)
    const [chatOpen, setChatOpen] = useState(false)
    const [md, setMd] = useState(`
# Hello World
`)

    MdEditor.use(ChatPlugin, {open: chatOpen, onClick: (open: boolean) => setChatOpen(open)})
    MdEditor.unuse(Plugins.Image)
    MdEditor.unuse(Plugins.Table)
    MdEditor.unuse(Plugins.Link)
    MdEditor.unuse(Plugins.Clear)
    return (
        <>
            <Tabs value={action} onChange={(_, v) => setAction(v)}>
                <Tab value={EditorAction.Editor} label={"編輯器"} />
                <Tab value={EditorAction.History} label={"編輯歷史"} />
            </Tabs>

            <Box sx={{display: action === "editor" ? "block" : "none"}}>
                <Grid container>
                    <Grid size={chatOpen ? 8 : 12}>
                        <MdEditor
                            style={{ height: '500px' }}
                            value={md}
                            renderHTML={text => <Markdown>{text}</Markdown>}
                            onChange={(e) => setMd(e.text)}
                        />
                    </Grid>
                    <Grid size={4} sx={{display: chatOpen ? "block" : "none"}}>
                        <Box sx={{overflowY: "auto", maxHeight: "500px"}}>
                            <MessageBox retracted={false} status={"received"} notch={true} replyButton={false} removeButton={false} position={"left"} title={"a"} type={"text"} text={"content"} id={"aaa"} focus={true} date={dayjs().toDate()} titleColor={"black"} forwarded={false} />
                            <MessageBox retracted={false} status={"received"} notch={true} replyButton={false} removeButton={false} position={"right"} title={"a"} type={"text"} text={"content"} id={"aaa"} focus={true} date={dayjs().toDate()} titleColor={"black"} forwarded={false} />
                            <MessageBox retracted={false} status={"received"} notch={true} replyButton={false} removeButton={false} position={"left"} title={"a"} type={"text"} text={"content"} id={"aaa"} focus={true} date={dayjs().toDate()} titleColor={"black"} forwarded={false} />
                            <MessageBox retracted={false} status={"received"} notch={true} replyButton={false} removeButton={false} position={"right"} title={"a"} type={"text"} text={"content"} id={"aaa"} focus={true} date={dayjs().toDate()} titleColor={"black"} forwarded={false} />
                            <MessageBox retracted={false} status={"received"} notch={true} replyButton={false} removeButton={false} position={"left"} title={"a"} type={"text"} text={"content"} id={"aaa"} focus={true} date={dayjs().toDate()} titleColor={"black"} forwarded={false} />
                            <MessageBox retracted={false} status={"received"} notch={true} replyButton={false} removeButton={false} position={"right"} title={"a"} type={"text"} text={"content"} id={"aaa"} focus={true} date={dayjs().toDate()} titleColor={"black"} forwarded={false} />
                            <MessageBox retracted={false} status={"received"} notch={true} replyButton={false} removeButton={false} position={"left"} title={"a"} type={"text"} text={"content"} id={"aaa"} focus={true} date={dayjs().toDate()} titleColor={"black"} forwarded={false} />
                            <MessageBox retracted={false} status={"received"} notch={true} replyButton={false} removeButton={false} position={"right"} title={"a"} type={"text"} text={"content"} id={"aaa"} focus={true} date={dayjs().toDate()} titleColor={"black"} forwarded={false} />
                            <MessageBox retracted={false} status={"received"} notch={true} replyButton={false} removeButton={false} position={"left"} title={"a"} type={"text"} text={"content"} id={"aaa"} focus={true} date={dayjs().toDate()} titleColor={"black"} forwarded={false} />
                            <MessageBox retracted={false} status={"received"} notch={true} replyButton={false} removeButton={false} position={"right"} title={"a"} type={"text"} text={"content"} id={"aaa"} focus={true} date={dayjs().toDate()} titleColor={"black"} forwarded={false} />
                            <MessageBox retracted={false} status={"received"} notch={true} replyButton={false} removeButton={false} position={"left"} title={"a"} type={"text"} text={"content"} id={"aaa"} focus={true} date={dayjs().toDate()} titleColor={"black"} forwarded={false} />
                            <MessageBox retracted={false} status={"received"} notch={true} replyButton={false} removeButton={false} position={"right"} title={"a"} type={"text"} text={"content"} id={"aaa"} focus={true} date={dayjs().toDate()} titleColor={"black"} forwarded={false} />
                            <MessageBox retracted={false} status={"received"} notch={true} replyButton={false} removeButton={false} position={"left"} title={"a"} type={"text"} text={"content"} id={"aaa"} focus={true} date={dayjs().toDate()} titleColor={"black"} forwarded={false} />
                            <MessageBox retracted={false} status={"received"} notch={true} replyButton={false} removeButton={false} position={"right"} title={"a"} type={"text"} text={"content"} id={"aaa"} focus={true} date={dayjs().toDate()} titleColor={"black"} forwarded={false} />
                            <MessageBox retracted={false} status={"received"} notch={true} replyButton={false} removeButton={false} position={"left"} title={"a"} type={"text"} text={"content"} id={"aaa"} focus={true} date={dayjs().toDate()} titleColor={"black"} forwarded={false} />
                            <MessageBox retracted={false} status={"received"} notch={true} replyButton={false} removeButton={false} position={"right"} title={"a"} type={"text"} text={"content"} id={"aaa"} focus={true} date={dayjs().toDate()} titleColor={"black"} forwarded={false} />
                            <MessageBox retracted={false} status={"received"} notch={true} replyButton={false} removeButton={false} position={"left"} title={"a"} type={"text"} text={"content"} id={"aaa"} focus={true} date={dayjs().toDate()} titleColor={"black"} forwarded={false} />
                            <MessageBox retracted={false} status={"sent"} notch={false} replyButton={true} removeButton={true} position={"right"} title={"a"} type={"text"} text={"content"} id={"aaa"} focus={false} date={dayjs().toDate()} titleColor={"black"} forwarded={false} />
                        </Box>

                        聊天視窗在這裡
                    </Grid>
                </Grid>

            </Box>
        </>
    )
}