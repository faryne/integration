import { Fragment, useId, type CSSProperties, type ReactNode } from "react";
import { Box, Typography } from "@mui/material";

import {
  assetImageFrameSx,
  CLEAR_FLOATING_ASSET_SX,
} from "./wysiwygCore/assetImageLayout";
import { BG_COLOR_CSS, TEXT_COLOR_CSS } from "./wysiwygCore/colorStyles";
import { renderFootnoteNote } from "./wysiwygCore/footnoteRender";
import {
  STORYTELLER_CODE_BLOCK_SX,
  StorytellerCodeBlockFrame,
} from "./wysiwygCore/storytellerCodeBlockView";
import { renderStorytellerCodeBlockHighlight } from "./wysiwygCore/storytellerCodeBlockHighlight";
import {
  computeFootnoteNumbering,
  groupParagraphsByBlockKind,
  parseMarkdownToParagraphs,
  splitRunsIntoCells,
  storyHeadingAnchorId,
  type FootnoteListEntry,
  type FootnoteNumbering,
  type ParsedParagraph,
  type ParsedRun,
} from "./wysiwygCore/parser";
import { HEADING_TYPOGRAPHY_SX } from "./wysiwygCore/typographySx";
import { isSafeHref, type MarkName } from "./wysiwygCore/whitelist";

interface StorytellerWysiwygMarkdownProps {
  children: string;
  /**
   * 外部已經算好的腳注編號＋清單。故事內容如果是逐段落/逐行渲染（例如 Reader.tsx 要在
   * 每行掛書籤功能，一行對應一個 StorytellerWysiwygMarkdown 實例），編號跟尾端清單
   * 必須用「整篇故事」算出來的同一份結果，不能讓每個實例各自從 children（只有一行）
   * 重新算一次——不然每行都會從編號 1 開始，且每行只要有腳注就會各自渲染一次尾端清單。
   * 不提供時退回自己從 children 算一份，適合「一次拿到全部內容」的呼叫端。
   */
  footnoteNumbering?: FootnoteNumbering;
  /**
   * 錨點/回連結 DOM id 的前綴。同一篇故事的所有渲染單位（不管是一個實例涵蓋全部內容，
   * 還是逐行多個實例）都要共用同一個值，上標編號連結才能跳轉到正確的（也是共用的）
   * 腳注清單項目。不提供時退回 useId()（單一元件自己用，跟以前的行為一致）。
   */
  footnoteIdPrefix?: string;
  /**
   * 是否渲染腳注清單（尾端區塊）。逐行渲染時，呼叫端應該只在故事最後一行之後渲染一次
   * （用 StorytellerFootnoteSection 自己渲染），其餘每一行都要傳 false，避免每行各自
   * 重複渲染。預設 true（單一元件涵蓋全部內容時的行為，向後相容）。
   */
  showFootnoteSection?: boolean;
  /**
   * 有序清單項目的起始編號，只有逐行渲染（見 footnoteNumbering 的說明）才需要傳。
   * 儲存的內容裡每個有序清單項目的前綴永遠是固定的 "1. "（見 whitelist.ts 的
   * BLOCK_KIND_NUMBER_CANONICAL_PREFIX），真正的編號完全交給原生 <ol> 接續算——但
   * 逐行渲染時每個實例天生只有一個 <li>，瀏覽器沒辦法跨實例接續，所以呼叫端要自己
   * 算「這一行在目前這串連續有序清單裡排第幾個」再傳進來，這裡用 <ol start={N}>
   * 補回視覺上的連續編號。不提供時預設 1（單一元件涵蓋全部內容時，group 內本來就是
   * 從第一個項目開始，向後相容）。
   */
  orderedListStart?: number;
}

// 引用/清單在閱讀頁走真正的巢狀 DOM（跟編輯區的 CSS 錯覺分組不同，見
// StorytellerWysiwygEditor.tsx 的 BLOCK_KIND_SX 說明——這裡是純 React 渲染，
// 沒有 ProseMirror schema 的限制，可以直接輸出真正的 <blockquote>/<ul>/<ol>）。
// 有序清單用真正的 <ol>，編號交給瀏覽器原生處理，不用自己算。
const BLOCK_GROUP_SX = {
  ...STORYTELLER_CODE_BLOCK_SX,
  "& blockquote": {
    margin: "0 0 0.5em 0",
    paddingLeft: "12px",
    borderLeft: "4px solid",
    borderColor: "divider",
    fontStyle: "italic",
    color: "text.secondary",
  },
  "& blockquote p": {
    margin: 0,
  },
  "& ul, & ol": {
    margin: "0 0 0.5em 0",
    paddingLeft: "24px",
  },
  "& li": {
    lineHeight: 1.5,
  },
  "& hr": {
    margin: "1.5em 0",
    border: "none",
    borderTop: "1px solid",
    borderColor: "divider",
  },
  "& table": {
    margin: "0 0 0.5em 0",
    borderCollapse: "collapse",
    width: "100%",
    // 跟編輯區同一套改動（見 StorytellerWysiwygEditor.tsx 同樣位置的說明）：改
    // table-layout:auto 為 fixed，避免欄寬隨內容即時重新計算而抖動，這裡的表格
    // 是唯讀閱讀頁不會有組字問題，但欄寬計算邏輯要跟編輯區一致，不然編輯區看到
    // 的欄寬比例跟閱讀頁顯示的會不一樣。
    tableLayout: "fixed",
  },
  "& td, & th": {
    border: "1px solid",
    borderColor: "divider",
    padding: "6px 10px",
    verticalAlign: "top",
    wordBreak: "break-word",
  },
  "& th": {
    backgroundColor: "action.hover",
    fontWeight: 700,
  },
} as const;

const MARK_TAG: Record<MarkName, keyof React.JSX.IntrinsicElements> = {
  bold: "strong",
  italic: "em",
  underline: "u",
  subscript: "sub",
  superscript: "sup",
  strike: "s",
};

function renderRun(run: ParsedRun, key: number): ReactNode {
  if (run.assetSrc || run.assetPublicId) {
    return (
      <Box
        key={key}
        component="span"
        data-asset-layout={run.assetLayout}
        data-asset-size={run.assetSize}
        sx={assetImageFrameSx(run.assetLayout, run.assetSize)}
      >
        {run.assetSrc ? (
          <Box
            component="img"
            src={run.assetSrc}
            alt={run.assetAlt ?? ""}
            sx={{
              width: "100%",
              maxHeight: { xs: 420, md: 640 },
              objectFit: "contain",
              display: "block",
            }}
          />
        ) : (
          <Typography
            component="span"
            variant="body2"
            color="text.secondary"
            sx={{ display: "block", p: 2 }}
          >
            資產：{run.assetAlt || run.assetPublicId}
          </Typography>
        )}
        {run.assetCaption ? (
          <Typography
            component="span"
            variant="body2"
            color="text.secondary"
            sx={{
              display: "block",
              pt: 0.75,
              fontStyle: "italic",
              textAlign: "center",
              overflowWrap: "anywhere",
            }}
          >
            {run.assetCaption}
          </Typography>
        ) : null}
      </Box>
    );
  }
  let node: ReactNode = run.text;
  for (const mark of run.marks) {
    const Tag = MARK_TAG[mark];
    node = <Tag key={`${key}-${mark}`}>{node}</Tag>;
  }
  // 文字顏色／背景色：值一律取自固定色盤的對照表（colorStyles.ts），不是把序列化字串
  // 原樣塞進 style，符合「不接受使用者自填 CSS」的安全規則。
  const style: CSSProperties = {};
  if (run.textColor) style.color = TEXT_COLOR_CSS[run.textColor];
  if (run.bgColor) style.backgroundColor = BG_COLOR_CSS[run.bgColor];
  if (style.color || style.backgroundColor) {
    node = (
      <span key={`${key}-color`} style={style}>
        {node}
      </span>
    );
  }
  // 連結：parser 已經檢查過 scheme，這裡渲染前再檢查一次（防禦性、不假設上一層
  // 一定擋過）——每一層都要各自驗證，不能只靠其中一關。target=_blank 一定要配
  // rel="noopener noreferrer"，防止新分頁透過 window.opener 回頭操作原本頁面。
  if (run.href && isSafeHref(run.href)) {
    return (
      <a
        key={key}
        href={run.href}
        target={run.target}
        rel={run.target === "_blank" ? "noopener noreferrer" : undefined}
      >
        {node}
      </a>
    );
  }
  return <span key={key}>{node}</span>;
}

/** 上標編號連結的錨點 id，跟尾端清單項目的 id 成對出現，見下面兩個函式共用同一個前綴規則。 */
function footnoteAnchorId(idPrefix: string, footnoteId: string): string {
  return `${idPrefix}fn-anchor-${footnoteId}`;
}

function footnoteNoteId(idPrefix: string, footnoteId: string): string {
  return `${idPrefix}fn-note-${footnoteId}`;
}

/**
 * 一個段落的 runs 裡，連續幾個 run 只要 footnoteId 相同就代表同一個腳注錨點（例如錨定
 * 文字裡有一段粗體，會被拆成兩個 run，但都掛著同一個 footnoteId）——只在這組的最後一個
 * run 之後插入一次上標編號連結，不是每個 run 各插一次。
 *
 * idPrefix 是這個上標連結對應的 DOM id 前綴，必須跟渲染尾端清單那個
 * StorytellerFootnoteSection 用同一個值，上標編號才能正確跳轉到清單裡對應的項目
 * （見 StorytellerWysiwygMarkdownProps 的 footnoteIdPrefix 說明）。
 */
function renderParagraphRuns(
  runs: ParsedRun[],
  footnoteNumbers: Map<string, number>,
  idPrefix: string,
): ReactNode[] {
  const nodes: ReactNode[] = [];
  runs.forEach((run, index) => {
    nodes.push(renderRun(run, index));
    const isLastOfFootnoteGroup =
      run.footnoteId && run.footnoteId !== runs[index + 1]?.footnoteId;
    if (isLastOfFootnoteGroup && run.footnoteId) {
      const number = footnoteNumbers.get(run.footnoteId);
      nodes.push(
        <sup key={`${index}-footnote-ref`}>
          <a
            id={footnoteAnchorId(idPrefix, run.footnoteId)}
            href={`#${footnoteNoteId(idPrefix, run.footnoteId)}`}
          >
            [{number}]
          </a>
        </sup>,
      );
    }
  });
  return nodes;
}

/** 每個儲存格去除頭尾空白後只剩下 -／: 字元（例如 `---`、`:--:`），視為表格分隔列的一格。 */
const TABLE_SEPARATOR_CELL_PATTERN = /^:?-+:?$/;

/**
 * 標準 markdown 表格慣例在表頭列後面接一列 `|---|---|---|` 當分隔列——這是主要支援的
 * 輸入方式（見 whitelist.ts 的 BLOCK_KIND_TABLE_ROW_PREFIX 說明）。偵測到分隔列就不當
 * 資料列渲染，而是把它前一列改渲染成 <thead><th>。儲存內容本身沒有 header/body 的
 * 概念，這是渲染時才做的判斷；沒打分隔列的話所有列都當一般資料列。
 */
function isTableSeparatorRow(paragraph: ParsedParagraph): boolean {
  const cells = splitRunsIntoCells(paragraph.runs);
  return cells.every((cell) =>
    TABLE_SEPARATOR_CELL_PATTERN.test(
      cell
        .map((run) => run.text)
        .join("")
        .trim(),
    ),
  );
}

/** 渲染一個段落的行內內容（runs），不含外層標籤——給一般段落/標題跟清單/引用項目共用。 */
function renderParagraphContent(
  paragraph: ParsedParagraph,
  footnoteNumbering: FootnoteNumbering,
  footnoteIdPrefix: string,
): ReactNode {
  return paragraph.runs.length === 0
    ? " "
    : renderParagraphRuns(
        paragraph.runs,
        footnoteNumbering.numbers,
        footnoteIdPrefix,
      );
}

function renderTableCellContent(
  runs: ParsedRun[],
  footnoteNumbering: FootnoteNumbering,
  footnoteIdPrefix: string,
): ReactNode {
  return runs.length === 0
    ? " "
    : renderParagraphRuns(runs, footnoteNumbering.numbers, footnoteIdPrefix);
}

/**
 * 故事尾端的腳注清單，獨立匯出成自己的元件——故事內容如果是逐段落/逐行渲染（例如
 * Reader.tsx 要在每行掛書籤功能），這個區塊只應該在整篇故事的最尾端渲染一次，
 * 不能讓 StorytellerWysiwygMarkdown 每個逐行實例各自渲染一次（那樣腳注就會出現在
 * 每一行甚至每個標題底下，而不是只在故事最尾端），所以拆出來讓呼叫端自己決定何時渲染。
 * idPrefix 必須跟內文裡產生上標編號連結的那些 StorytellerWysiwygMarkdown 實例共用
 * 同一個值。
 */
export function StorytellerFootnoteSection({
  list,
  idPrefix,
}: {
  list: FootnoteListEntry[];
  idPrefix: string;
}) {
  if (list.length === 0) return null;
  return (
    <Box
      component="section"
      sx={{
        mt: 3,
        pt: 1.5,
        borderTop: "1px solid",
        borderColor: "divider",
      }}
    >
      <Typography variant="subtitle2" component="h2" sx={{ mb: 1 }}>
        腳注
      </Typography>
      <Box component="ol" sx={{ m: 0, pl: 3 }}>
        {list.map(({ footnoteId, note }) => (
          <Typography
            key={footnoteId}
            component="li"
            variant="body2"
            id={footnoteNoteId(idPrefix, footnoteId)}
          >
            <a href={`#${footnoteAnchorId(idPrefix, footnoteId)}`}>{"↩"}</a>{" "}
            {renderFootnoteNote(note)}
          </Typography>
        ))}
      </Box>
    </Box>
  );
}

/**
 * 所見即所得編輯器的白名單解析器版本 StorytellerMarkdown，介面刻意相容
 * （同樣吃 `children: string`），給故事內容的所有閱讀端（編輯頁預覽面板、公開
 * 閱讀頁、版本 diff）共用同一套解析結果——不是重新實作一套規則，是直接呼叫
 * wysiwygCore/parser.ts 的 parseMarkdownToParagraphs，跟編輯器本身用同一份邏輯。
 *
 * 只給「故事內容」（可能含新 marker 語法）這種來源用；LoreEditor／AI Agent
 * 面板／使用者簡介這些還沒換新編輯器產生內容的地方，繼續用原本的
 * StorytellerMarkdown（remark-gfm），不要混著換。
 */
export function StorytellerWysiwygMarkdown({
  children,
  footnoteNumbering: externalFootnoteNumbering,
  footnoteIdPrefix: externalFootnoteIdPrefix,
  showFootnoteSection = true,
  orderedListStart,
}: StorytellerWysiwygMarkdownProps) {
  const paragraphs = parseMarkdownToParagraphs(children);
  // useId() 一定要無條件呼叫（Hook 規則），就算外部有提供 footnoteIdPrefix 也一樣呼叫，
  // 只是呼叫出來的值不會被用到——這樣才不會因為 props 不同而改變 Hook 呼叫的數量/順序。
  const generatedIdPrefix = useId();
  const footnoteIdPrefix = externalFootnoteIdPrefix ?? generatedIdPrefix;
  const footnoteNumbering =
    externalFootnoteNumbering ?? computeFootnoteNumbering(children);

  return (
    <Box sx={[HEADING_TYPOGRAPHY_SX, BLOCK_GROUP_SX, CLEAR_FLOATING_ASSET_SX]}>
      {groupParagraphsByBlockKind(paragraphs).map((group, groupIndex) => {
        if (group.blockKind === "code") {
          const { paragraph, index } = group.items[0];
          const content = paragraph.runs.map((run) => run.text).join("");
          const highlightedContent = renderStorytellerCodeBlockHighlight(
            paragraph.language,
            content,
          );
          return (
            <StorytellerCodeBlockFrame
              key={paragraph.markerId ?? index}
              markerId={paragraph.markerId}
              language={paragraph.language}
              content={content}
            >
              {highlightedContent ?? content}
            </StorytellerCodeBlockFrame>
          );
        }

        if (group.blockKind === "none") {
          const { paragraph, index } = group.items[0];
          const HeadingOrParagraphTag =
            paragraph.headingLevel > 0
              ? (`h${paragraph.headingLevel}` as keyof React.JSX.IntrinsicElements)
              : "p";
          return (
            <HeadingOrParagraphTag
              key={paragraph.markerId ?? index}
              id={
                paragraph.headingLevel > 0 && paragraph.markerId
                  ? storyHeadingAnchorId(paragraph.markerId)
                  : undefined
              }
              style={{ textAlign: paragraph.align }}
            >
              {renderParagraphContent(
                paragraph,
                footnoteNumbering,
                footnoteIdPrefix,
              )}
            </HeadingOrParagraphTag>
          );
        }

        if (group.blockKind === "hr") {
          // 分隔線沒有行內內容可渲染，也不需要像引用/清單那樣合併成一個容器——
          // 連續幾條分隔線就是各自獨立的幾條 <hr>。
          return (
            <Fragment key={`block-group-${groupIndex}`}>
              {group.items.map(({ paragraph, index }) => (
                <hr key={paragraph.markerId ?? index} />
              ))}
            </Fragment>
          );
        }

        if (group.blockKind === "table") {
          return (
            <Box component="table" key={`block-group-${groupIndex}`}>
              <tbody>
                {group.items.map(({ paragraph, index }) => (
                  <tr key={paragraph.rowId ?? index}>
                    {(paragraph.tableCells ?? [[]]).map(
                      (cellRuns, cellIndex) => (
                        <td key={cellIndex}>
                          {renderTableCellContent(
                            cellRuns,
                            footnoteNumbering,
                            footnoteIdPrefix,
                          )}
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </Box>
          );
        }

        if (group.blockKind === "table-row") {
          // 連續的表格列合併成一個 <table>，每個段落是一個 <tr>；儲存格是渲染時才用
          // splitRunsIntoCells 從已解析的 runs 切出來的（見 whitelist.ts 的
          // BLOCK_KIND_TABLE_ROW_PREFIX 說明），不是解析階段就存成巢狀結構。
          const rows = group.items;
          const hasHeaderSeparator =
            rows.length > 1 && isTableSeparatorRow(rows[1].paragraph);
          const headerItem = hasHeaderSeparator ? rows[0] : null;
          const bodyItems = rows.filter(({ paragraph }, itemIndex) => {
            if (hasHeaderSeparator && itemIndex <= 1) return false;
            return !isTableSeparatorRow(paragraph);
          });
          return (
            <Box component="table" key={`block-group-${groupIndex}`}>
              {headerItem && (
                <thead>
                  <tr>
                    {splitRunsIntoCells(headerItem.paragraph.runs).map(
                      (cellRuns, cellIndex) => (
                        <th
                          key={cellIndex}
                          style={{ textAlign: headerItem.paragraph.align }}
                        >
                          {cellRuns.length === 0
                            ? " "
                            : renderParagraphRuns(
                                cellRuns,
                                footnoteNumbering.numbers,
                                footnoteIdPrefix,
                              )}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
              )}
              <tbody>
                {bodyItems.map(({ paragraph, index }) => (
                  <tr key={paragraph.markerId ?? index}>
                    {splitRunsIntoCells(paragraph.runs).map(
                      (cellRuns, cellIndex) => (
                        <td
                          key={cellIndex}
                          style={{ textAlign: paragraph.align }}
                        >
                          {cellRuns.length === 0
                            ? " "
                            : renderParagraphRuns(
                                cellRuns,
                                footnoteNumbering.numbers,
                                footnoteIdPrefix,
                              )}
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </Box>
          );
        }

        const ItemTag = group.blockKind === "quote" ? "p" : "li";
        const WrapperTag =
          group.blockKind === "quote"
            ? "blockquote"
            : group.blockKind === "bullet"
              ? "ul"
              : "ol";
        return (
          <Box
            component={WrapperTag}
            key={`block-group-${groupIndex}`}
            {...(WrapperTag === "ol" ? { start: orderedListStart ?? 1 } : {})}
          >
            {group.items.map(({ paragraph, index }) => (
              <Box
                component={ItemTag}
                key={paragraph.markerId ?? index}
                style={{ textAlign: paragraph.align }}
              >
                {renderParagraphContent(
                  paragraph,
                  footnoteNumbering,
                  footnoteIdPrefix,
                )}
              </Box>
            ))}
          </Box>
        );
      })}

      {showFootnoteSection && (
        <StorytellerFootnoteSection
          list={footnoteNumbering.list}
          idPrefix={footnoteIdPrefix}
        />
      )}
    </Box>
  );
}
