import { parseFeed, type AnyFeed } from "feedsmith"
import "./style.css"

export type ParagraphContent = {
    type: "paragraph",
    text: string
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

export type AnyContent = ParagraphContent | HeaderContent | ImageContent

export type Feed = {
    id: string,
    name: string,
    url: string,
    corsProxy: boolean,
    type: "rss" | "atom" | "rdf" | "json",
    category: "news" | "comics"
}

export type Article = {
    source: Feed,
    time: string,
    title: string,
    desc: string,
    contents: AnyContent[],
    link: string
}

const templateFeeds: Feed[] = [
    {
        id: "yle_main",
        name: "Yle main news",
        url: "https://yle.fi/rss/uutiset/paauutiset",
        corsProxy: true,
        type: "rss",
        category: "news"
    },
    {
        id: "hs",
        name: "HS Helsinki",
        url: "https://www.hs.fi/rss/tuoreimmat.xml",
        corsProxy: false,
        type: "rss",
        category: "news"
    },
    {
        id: "xkcd",
        name: "xkcd",
        url: "https://xkcd.com/atom.xml",
        corsProxy: true,
        type: "atom",
        category: "comics"
    }
]

let feeds: Feed[] = templateFeeds

async function getFeed(feed: Feed) {
    const text = await (await fetch(`${feed.corsProxy ? "https://cors-proxy.hekinav.dev/" : ""}${feed.url}`)).text()
    const data = parseFeed(text)
    return data
}

async function renderPaper() {
    const parsed: [Feed, AnyFeed][] = (await Promise.all(feeds.map(async f => ([f, await getFeed(f)]))))
    console.log(parsed)
    const combinedArticles: Article[] = (await Promise.all(parsed.map(p => parseArticles(p[0], p[1])))).flat()
    console.log(combinedArticles)
}

async function parseArticles(feed: Feed, feedData: AnyFeed): Promise<Article[]> {
    switch (feedData.format) {
        case "rss":
            return await Promise.all(feedData.feed.items?.slice(0,1).map<Promise<Article>>(async i => ({
                source: feed,
                time: i.pubDate || new Date().toISOString(),
                title: i.title || "",
                desc: i.description || "",
                contents: await getContents(i.link || "", feed),
                link: i.link || ""
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
        figcaption, h2:not(aside h2), h3:not(aside h3), h4:not(aside h4))`).forEach((e, i, a) => {
        switch (e.tagName) {
            case "P":
                contents.push({type: "paragraph", text: e.textContent})
                break;
            case "IMG":
                contents.push({type: "image", src: (e as HTMLImageElement).src || null, alt: (e as HTMLImageElement).alt || null, caption: a[i+1] && a[i+1].tagName == "FIGCAPTION" ? a[i+1].textContent : null})
                break;
            case "H2":
                contents.push({type: "header", level: 2, text: e.textContent})
                break;
            case "H3":
                contents.push({type: "header", level: 3, text: e.textContent})
                break;
            case "H4":
                contents.push({type: "header", level: 4, text: e.textContent})
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


renderPaper()
