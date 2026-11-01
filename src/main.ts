import { parseFeed, type AnyFeed } from "feedsmith"
import * as pretext from "@chenglou/pretext"
import "./style.css"

const COLUMN_WIDTH = 400 //px
const PAGE_WIDTH = 1280 //px
const PAGE_HEIGHT = 800 //px
const PAGE_MARGIN = 40 //px
const FONT_SIZE = 16 //px
const P_MULT = 1 // compared to font size
const H1_MULT = 2.1 // compared to font size
const H2_MULT = 1.8 // compared to font size
const H3_MULT = 1.6 // compared to font size
const H4_MULT = 1.4 // compared to font size

export type ParagraphContent = {
    type: "paragraph",
    text: string
}

export type HTMLContent = {
    type: "html",
    html: string
}

export type HeaderContent = {
    type: "header",
    level: number,
    text: string
}

export type ImageContent = {
    type: "image",
    src: string | null,
    alt: string | null,
    caption: string | null
}

export type AnyContent = ParagraphContent | HeaderContent | ImageContent | HTMLContent

export type Feed = {
    id: string,
    name: string,
    url: string,
    corsProxy: boolean,
    type: "rss" | "atom" | "rdf" | "json",
    scrape: boolean
}

export type Article = {
    source: Feed,
    time: string,
    title: string,
    desc: string,
    contents: AnyContent[],
    link: string,
}

export type GridItem = {
    height: number,
    id: string
}

const templateFeeds: Feed[] = [
    {
        id: "yle_main",
        name: "Yle",
        url: "https://yle.fi/rss/uutiset/paauutiset",
        corsProxy: true,
        type: "rss",
        scrape: true
    }/* ,
    {
        id: "nyt",
        name: "New York Times",
        url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
        corsProxy: false,
        type: "rss",
        scrape: false
    },
    {
        id: "hs",
        name: "HS",
        url: "https://www.hs.fi/rss/tuoreimmat.xml",
        corsProxy: false,
        type: "rss",
        scrape: true
    },
    {
        id: "XKCD",
        name: "XKCD",
        url: "https://xkcd.com/atom.xml",
        corsProxy: true,
        type: "atom",
        scrape: false
    },
    {
        id: "github/hsldevcom/digitransit-ui",
        name: "Commits of Digitransit UI",
        corsProxy: true,
        scrape: false,
        type: "atom",
        url: "https://github.com/hsldevcom/digitransit-ui/commits.atom"
    } */
]

let feeds: Feed[] = templateFeeds

let articles: Article[] = []

async function getFeed(feed: Feed) {
    const text = await (await fetch(`${feed.corsProxy ? "https://cors-proxy.hekinav.dev/" : ""}${feed.url}`)).text()
    const data = parseFeed(text)
    return data
}

async function getPaper() {
    const parsed: [Feed, AnyFeed][] = (await Promise.all(feeds.map(async f => ([f, await getFeed(f)]))))
    articles = shuffleArray((await Promise.all(parsed.map(p => parseArticles(p[0], p[1])))).flat())

    await renderPaper()
}

async function renderPaper() {
    let remaining = [...articles]

    const paper: HTMLDivElement = document.querySelector("#paper")!

    // unit is columns/rows
    const pageUsableSize = [Math.floor((PAGE_WIDTH - PAGE_MARGIN * 2) / COLUMN_WIDTH), Math.floor((PAGE_HEIGHT - PAGE_MARGIN * 2) / FONT_SIZE)]
    const offset = [(PAGE_WIDTH - pageUsableSize[0] * COLUMN_WIDTH) / 2, (PAGE_HEIGHT - pageUsableSize[1] * FONT_SIZE) / 2]

    function reloadPaper() {
        paper.style.padding = `${offset[0]}px ${offset[1]}px`
        paper.style.gridTemplateAreas = `"${transpose(paperGrid).map(c => c.reduce<string[]>((p, e) => e ? [...p, e.id] : p, []).join(" ")).join('"\n"')}"`
        paper.style.gridTemplateColumns = `repeat(${paperGrid.length}, 1fr)`
        paper.style.width = `${PAGE_WIDTH - PAGE_MARGIN * 2}px`
        paper.style.height = `${PAGE_HEIGHT - PAGE_MARGIN * 2}px`
    }

    let paperGrid: GridItem[][] = []

    while (remaining.length > 0) {

        let article = remaining.slice(0, 1)[0]

        const wtitlePrepared = pretext.prepare(article.title, `${FONT_SIZE * H1_MULT}px Times New Roman`)
        const wtitlelayout = pretext.layout(wtitlePrepared, COLUMN_WIDTH, Math.ceil(H1_MULT) * FONT_SIZE)

        const bodyHeight = (await Promise.all(article.contents.map(c => getHeight(c, COLUMN_WIDTH)))).reduce((n, p) => n + p, 0)

        let article_cols = Math.max(Math.ceil(wtitlelayout.lineCount / 3), Math.ceil(bodyHeight / (pageUsableSize[1] * FONT_SIZE)))

        const titleHeight = await getHeight({ type: "header", level: 1, text: article.title }, COLUMN_WIDTH * article_cols)

        const paragraphHeight = Math.ceil((bodyHeight - titleHeight) / article_cols / FONT_SIZE) * FONT_SIZE

        let firstCol: number = paperGrid.findIndex(c => c.reduce<number>((p, i) => p + i.height, 0) < 0.4 * pageUsableSize[1] * FONT_SIZE)
        if (firstCol == -1) firstCol = paperGrid.length

        remaining.splice(0, 1)

        if (firstCol < pageUsableSize[0]) {
            const titleId = "T-" + crypto.randomUUID().slice(0, 8)

            for (let i = 0; i < article_cols; i++) {
                if (!paperGrid[firstCol + i]) paperGrid[firstCol + i] = []
                const col = paperGrid[firstCol + i]
                if (col) col.push({ height: titleHeight, id: titleId })
            }

            const title = document.createElement("h1")
            title.innerHTML = article.title
            title.style.height = `${titleHeight}px`
            title.style.fontSize = `${FONT_SIZE * H1_MULT}px`

            paper.appendChild(title)
            reloadPaper()

            title.style.gridArea = titleId

            for (let i = 0; i < article_cols; i++) {
                let total = 0

                let nextColumn = paperGrid.findIndex(c => c.reduce<number>((p, i) => p + i.height, 0) < 0.4 * pageUsableSize[1] * FONT_SIZE)
                if (nextColumn == -1) nextColumn = paperGrid.length
                if (nextColumn >= pageUsableSize[0]) break
                if (!paperGrid[nextColumn]) paperGrid[nextColumn] = []
                const nextColumnFree = pageUsableSize[1] * FONT_SIZE - paperGrid[nextColumn].reduce<number>((p, i) => p + i.height, 0)

                const id = "P-" + crypto.randomUUID().slice(0, 8)

                const paragraph = document.createElement("div")
                paragraph.style.width = `${COLUMN_WIDTH}px`
                paragraph.style.height = `${paragraphHeight}px`
                paragraph.style.gridArea = id
                paragraph.classList.add("paragraph")

                while (total < Math.min(paragraphHeight, nextColumnFree)) {
                    const item = article.contents.slice(0, 1)[0]
                    if (!item) break
                    const height = await getHeight(item, COLUMN_WIDTH)
                    total += height
                    if (total < Math.min(paragraphHeight, nextColumnFree) - 6) {
                        paragraph.innerHTML += contentToHTML(item, height)
                        article.contents.splice(0, 1)
                    }
                }

                paperGrid[nextColumn].push({ height: Math.min(paragraphHeight, nextColumnFree), id: id })
                paper.appendChild(paragraph)
                reloadPaper()
                console.log(id)
            }
        }
    }
}

function transpose<T>(matrix: T[][]) {
    return matrix[0].map((_, i) => matrix.map(row => row[i]));
}

async function getHeight(item: AnyContent, width: number): Promise<number> {
    if (item.type == "image" || item.type == "html") {
        return await new Promise((res) => {
            const parser = new DOMParser()
            let el = parser.parseFromString(contentToHTML(item), "text/html").body.firstChild as HTMLElement | null
            if (!el) return res(0)
            el.style.position = "fixed"
            el.style.width = `${width - 32}px`

            document.body.appendChild(el)

            function end() {
                if (!el) return res(0)
                res(el.offsetHeight)
                document.body.removeChild(el)
            }

            if (el.tagName === 'IMG') {
                if ((el as HTMLImageElement).complete) {
                    end();
                } else {
                    el.addEventListener("load", end)
                    el.addEventListener("error", () => {
                        res(0)
                    })
                }
            } else {
                end()
            }
        })
    } else {
        const mult = (item.type == "paragraph" ? P_MULT : item.level == 1 ? H1_MULT : item.level == 2 ? H2_MULT : item.level == 3 ? H3_MULT : H4_MULT)
        const prepared = pretext.prepare(item.text, `${FONT_SIZE * mult}px Times New Roman`)
        const layout = pretext.layout(prepared, width, Math.ceil(mult) * FONT_SIZE)
        return item.type == "paragraph" ? layout.height + 6 : layout.height
    }
}

async function parseArticles(feed: Feed, feedData: AnyFeed): Promise<Article[]> {
    switch (feedData.format) {
        case "rss":
            return await Promise.all(feedData.feed.items?.slice(0, 10).map<Promise<Article>>(async i => ({
                source: feed,
                time: i.pubDate || new Date().toISOString(),
                title: i.title || "",
                desc: i.description || "",
                contents: feed.scrape ? (await getContents(i.link || "", feed)).filter(a => a.type == "paragraph" ? a.text != i.description : true) : [],
                link: i.link || ""
            })) || [])
        case "atom":
            return await Promise.all(feedData.feed.entries?.slice(0, 10).map<Promise<Article>>(async e => ({
                contents: feed.scrape ? (await getContents(e.links![0].href || "", feed)).filter(a => a.type == "paragraph" ? a.text != e.summary?.value : true) : [],
                desc: e.summary?.value || "",
                link: e.links![0].href || "",
                source: feed,
                time: e.updated || new Date().toISOString(),
                title: e.title?.value || ""
            })) || [])
        default:
            return []
    }
}

async function getContents(feedUrl: string, feed: Feed): Promise<AnyContent[]> {
    const text = await (await fetch(`${"https://cors-proxy.hekinav.dev/"}${feedUrl}`)).text()
    const html = new DOMParser().parseFromString(text, "text/html")
    const contents: AnyContent[] = []
    html.querySelectorAll(`
        article section
        :is(p:not(figcaption p${feed.id == "hs" ? ", .picture-fragment-container p" : ""}, aside p), 
        img${feed.id == "hs" ? ":not(.gap-nof-12.flex.flex-row.items-center.mb-nof-24 img)" : feed.id == "yle_main" ? ":not(a img)" : ""}, 
        figcaption, h2:not(aside h2), h3:not(aside h3),h4:not(aside h4))`).forEach((e, i, a) => {
        switch (e.tagName) {
            case "P":
                contents.push({ type: "paragraph", text: e.textContent })
                break;
            case "IMG":
                contents.push({ type: "image", src: (e as HTMLImageElement).src || null, alt: (e as HTMLImageElement).alt || null, caption: a[i + 1] && a[i + 1].tagName == "FIGCAPTION" ? a[i + 1].textContent : null })
                break;
            case "H2":
                contents.push({ type: "header", level: 2, text: e.textContent })
                break;
            case "H3":
                contents.push({ type: "header", level: 3, text: e.textContent })
                break;
            case "H4":
                contents.push({ type: "header", level: 4, text: e.textContent })
                break;
            case "FIGCAPTION":
                break;
            default:
                console.log(e.tagName)
                break;
        }
    })
    return contents
}

function contentToHTML(c: AnyContent, h?: number): string {
    switch (c.type) {
        case "paragraph":
            return `<p style="font-size: ${FONT_SIZE * P_MULT}px; margin: 6px 0">${c.text}</p>`
        case "header":
            return `<h${c.level} style="font-size: ${FONT_SIZE * (c.level == 1 ? H1_MULT : c.level == 2 ? H2_MULT : c.level == 3 ? H3_MULT : H4_MULT)}px; height: ${h}px">${c.text}</h${c.level}>`
        case "image":
            return `<figure><img src="${c.src}" alt="${c.alt}">${c.caption ? `<figcaption>${c.caption}</figcaption>` : ""}</figure>`
        case "html":
            return c.html
    }
}


function shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array
}


document.getElementById("app")!.innerHTML = `
<div id="paper">

</div>
`


getPaper()
